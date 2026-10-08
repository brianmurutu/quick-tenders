import { loadEnv } from './load-env.mjs';
loadEnv();

import { runDiscovery } from '../lib/tender-discovery.ts';
import { runDrafting } from '../lib/tender-documents.ts';
import { createAdminClient } from '../lib/supabase/admin.ts';

const COMPANY_ID = 'fd1caf89-581a-4a39-a943-5623e08a9132';

async function main() {
  console.log('====================================================');
  console.log('LIVE TEST RUN FOR admin@radiantreach.co.ke (Radiant Reach)');
  console.log('====================================================');

  console.log('\n1. Running AI Tender Discovery & Sector Matching...');
  const discoverySummary = await runDiscovery({
    companyId: COMPANY_ID,
    sourceIds: ['tenders-kenya', 'tendersinfo', 'gaa'],
    customSectors: ['ICT and software', 'Building and construction', 'Telecommunications'],
    notify: true,
  });

  console.log('--- Discovery Results ---');
  console.log('Tenders Fetched:', discoverySummary.tendersFetched);
  console.log('Open Tenders Evaluated:', discoverySummary.tendersAfterExpiryFilter);
  const comp = discoverySummary.companies[0];
  console.log('Company:', comp?.companyName);
  console.log('Scored:', comp?.scored);
  console.log('Above Threshold (Matches):', comp?.aboveThreshold);
  console.log('Inserted to Dashboard:', comp?.inserted);
  console.log('Top Match Score:', comp?.topScore);
  if (comp?.errors.length) console.log('Company Errors:', comp.errors);

  console.log('\n2. Drafting Word (.docx) Technical Bid Proposals with AI...');
  try {
    const draftingSummary = await runDrafting({
      companyId: COMPANY_ID,
      limit: 5,
    });
    console.log('Documents Created (.docx):', draftingSummary.totals.documentsCreated);
    console.log('Drafting Summary:', draftingSummary.tenders.map(t => ({
      title: t.title,
      docs: t.documentsCreated,
      emailed: t.emailed,
    })));
  } catch (err) {
    console.log('Drafting notice:', err instanceof Error ? err.message : String(err));
  }

  console.log('\n3. Verifying Dashboard Database State...');
  const admin = createAdminClient();
  const { data: matchedTenders } = await admin
    .from('tenders_matched')
    .select('id, title, procuring_entity, deadline, match_score, status')
    .eq('company_id', COMPANY_ID)
    .order('match_score', { ascending: false });

  console.log(`Total Active Matched Tenders for Radiant Reach in DB: ${matchedTenders?.length ?? 0}`);
  if (matchedTenders && matchedTenders.length > 0) {
    console.log('Top 3 Matched Tenders in Dashboard:');
    matchedTenders.slice(0, 3).forEach((t, i) => {
      console.log(`  [${i + 1}] (${t.match_score}%) ${t.title} - ${t.procuring_entity} (Deadline: ${t.deadline})`);
    });
  }

  console.log('\n====================================================');
  console.log('LIVE TEST RUN COMPLETE!');
  console.log('====================================================');
}

main().catch(console.error);
