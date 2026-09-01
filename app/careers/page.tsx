import type { Metadata } from 'next'

import { Bullets, ContactBlock, ContentPage, Section } from '@/components/content-page'

export const metadata: Metadata = {
  title: 'Careers | Quick Tenders',
  description: 'Open roles at Quick Tenders, and how to apply speculatively when there are none.',
}

export default function CareersPage() {
  return (
    <ContentPage
      eyebrow="Careers"
      title="Work on Quick Tenders"
      intro="Quick Tenders is a small product with a narrow job: find the tender, draft the bid, keep a company from missing a deadline. That focus shapes what the work looks like."
    >
      <Section heading="Open roles">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
          <p className="font-semibold text-slate-900">No open roles right now</p>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            When a role opens it will be listed on this page. Until then,
            speculative applications are read and answered.
          </p>
        </div>
      </Section>

      <Section heading="What the work tends to involve">
        <Bullets
          items={[
            'Owning a problem end to end, from the schema through to the copy a customer reads.',
            'Reading real tender documents, because the product is only as good as its grasp of what a bid actually asks for.',
            'Writing plainly. Much of the product is text, and drafts that read badly do not get used.',
            'Treating a missed deadline as a defect, not an edge case.',
          ]}
        />
      </Section>

      <Section heading="Applying speculatively">
        <p>
          Send a short note about what you would want to work on and one thing you
          have built or shipped that you can talk through in detail. A long CV is
          not needed.
        </p>
        <div className="max-w-sm">
          <ContactBlock label="Applications" email="careers@quicktenders.ke">
            Include a link to something you have made, if there is one to share.
          </ContactBlock>
        </div>
      </Section>
    </ContentPage>
  )
}
