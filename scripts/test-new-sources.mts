import { fetchAllTenders } from '../lib/tender-sources'

async function testFetch() {
  console.log('Testing fetchAllTenders for new sources...');
  const res = await fetchAllTenders(undefined, [
    'tenders-kenya',
    'tendersinfo',
    'tendersontime',
    'gaa',
    'kenyatenders',
    'tendersoko',
  ]);

  console.log('\n--- Sources Summary ---');
  for (const s of res.sources) {
    console.log(`${s.label} [${s.sourceId}]: status=${s.status}, fetched=${s.fetched}, discarded=${s.discarded}${s.detail ? ' (' + s.detail + ')' : ''}`);
  }

  console.log('\nTotal unique tenders fetched:', res.tenders.length);
  if (res.tenders.length > 0) {
    console.log('\nSample Tender:');
    console.log(res.tenders[0]);
  }
}

testFetch().catch(console.error);
