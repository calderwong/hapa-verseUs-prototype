"""Controlled probe of the exact relay report aggregator, not a network experiment."""
from pathlib import Path
import contextlib
import io
import json
import tempfile
import sys

root = Path(__file__).resolve().parent
source = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
script = (source / 'tools/hapa/relay-nat-witness.sh').read_text()
body = script.split("<<'EOF'\n", 1)[1].rsplit('\nEOF', 1)[0]
stage2 = json.loads((source / 'docs/reviews/evidence/2026-11-27/response-23/relay-witness-46101799012/stage2/summary.json').read_text())
observations = []
for missing in [None, 'Peer-c']:
    with tempfile.TemporaryDirectory(prefix='hapa-relay-gate-') as temporary:
        out = Path(temporary)
        reports = [p for p in stage2['peers'] if p['name'] != missing]
        for p in reports:
            (out / ('peer-' + p['name'].split('-')[-1] + '.json')).write_text(json.dumps(p))
        (out / 'relay-stats.json').write_text(json.dumps(stage2['relayStats']))
        (out / 'control.json').write_text(json.dumps(stage2['control']))
        previous = sys.argv
        sys.argv = ['review-probe', str(out), '2']
        exit_code = None
        try:
            with contextlib.redirect_stdout(io.StringIO()):
                try:
                    exec(compile(body, 'relay-nat-witness.sh:python-aggregator', 'exec'), {})
                except SystemExit as e:
                    exit_code = e.code
        finally:
            sys.argv = previous
        result = json.loads((out / 'summary.json').read_text())
        observations.append({'missing': missing, 'reports_present': len(reports), 'expected_pass': missing is None,
                             'actual_pass': result['ok'], 'exit_code': exit_code})
report = {'source': '164aa5dc6eb96ee4b4cc4eab6f0cdb2298554536',
          'kind': 'controlled_report_aggregation',
          'scope': 'Exact embedded Python aggregator, supplied report fields from the successful stage 2 run. No live network behavior is exercised.',
          'cases': observations,
          'finding_reproduced': observations[1]['actual_pass'] is True and observations[1]['expected_pass'] is False}
(root / 'probe-relay-report-gate-results.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report, indent=2))
