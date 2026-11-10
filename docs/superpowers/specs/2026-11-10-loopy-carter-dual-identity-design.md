# Loopy Carter + Da HoodFarmer Dual-Identity Website Design

Date: 2026-11-10
Status: Approved for implementation by the user's explicit execution delegation.

## Intent

Build one authoritative public digital home that makes **Loopy Carter** and **Da HoodFarmer** independently discoverable, while clearly connecting both names to the same real person and public story. The site should look like a polished public-figure, media, and brand headquarters—not a thin biography page.

The official domain remains https://dahoodfarmer.com. The current Cloudflare Pages project and repository are retained. The user has delegated implementation decisions and asked that both identities receive equal prominence.

## Goals

- Give Loopy Carter a dedicated, complete public profile and landing page.
- Give Da HoodFarmer a dedicated, complete public profile and brand landing page.
- Make the homepage present both identities equally and connect them with clear navigation.
- Help search engines understand one person with two established public names, plus a distinct agricultural/media brand identity.
- Add accurate, crawlable page titles, descriptions, canonical URLs, Open Graph/Twitter metadata, image alt text, sitemap entries, and JSON-LD structured data.
- Present a compelling, well-organized biography covering DMV/Northern Virginia roots, Carter family history, education, academy leadership, awards, agriculture, survival instruction, television, digital media, and business projects.
- Cite authoritative public sources for historical claims and clearly distinguish public records from family oral tradition and user-reported personal accomplishments.
- Use real user-supplied photography and brand assets where suitable.
- Improve professional conversion paths for media, casting, speaking, partnerships, and bookings.

## Non-goals and anti-goals

- Do not promise or imply that Google will grant a Knowledge Panel; Google controls that decision.
- Do not create two unrelated people/entities or two competing websites.
- Do not expose the user's private/legal name in public copy.
- Do not publish children's names, ages, photographs, school details, or other family-private details in this implementation. They can be added only after specific public-release approval and accurate source details.
- Do not invent follower counts, audience analytics, credits, award years, endorsements, business registrations, or operating businesses.
- Do not describe the user's military-academy education as military service or call the user a veteran.
- Do not use generated or composite imagery as if it were documentary photography of the user.
- Do not change production database bindings, production secrets, DNS, Access policies, or payment settings as part of this content project.

## Approaches considered

1. **One general biography page.** Lowest implementation cost, but it would not give both names independent landing pages or equal search intent coverage. Rejected.
2. **Two separate websites/domains.** Each name could have a separate site, but this would split authority, duplicate content, complicate ownership signals, and risk making Google treat the names as unrelated. Rejected.
3. **One canonical website with two dedicated identity pages and a shared identity graph.** Each name receives a distinct page, title, description, content focus, and social-preview metadata; both pages reference the same canonical Person entity. Da HoodFarmer is also represented as the associated brand. Selected because it balances independent discoverability with identity consistency.

## Architecture and implementation decisions

- Keep Cloudflare Pages project `dahoodfarmer-website` and custom domain `dahoodfarmer.com`.
- Work on a new feature branch from the current production commit `1d5238a8833ce0ea65a24213b57ed97245a498b7`; never push directly to `site-rebuild-v2`.
- Add `/loopy-carter` and `/da-hoodfarmer` as separate static pages.
- Update the homepage, About page, shared navigation/footer, sitemap, and relevant metadata.
- Use Schema.org JSON-LD with a shared Person `@id` for Loopy Carter and alternate names including Da HoodFarmer; represent Da HoodFarmer as the associated Brand with Loopy Carter as its founder/associated person.
- Use only confirmed official URLs in `sameAs`. Do not guess social profile URLs.
- Add source links to the Town of Vienna and Fairfax County for the Carter family history. Label family oral tradition as oral tradition, not independently established fact.
- Preserve the existing static HTML/CSS/JS architecture and existing forms/functions. No new framework or paid service is needed.

## Content standards

- Public name: **Loopy Carter**.
- Co-equal public brand identity: **Da HoodFarmer**.
- Public tagline: **DMV Roots. Southern Soul. Farmer's Heart. Entrepreneur's Mind.**
- User-reported facts may be included as personal biography, but third-party documentation should be linked when available.
- Describe the 88-acre farm as farm experience, not ownership.
- Describe Massanutten as military-academy/cadet leadership, not armed-forces service.
- Present Beat the Odds recognition by naming the Phoenix Award, college scholarship, and Distinguished Speaker appearance without assigning uncertain years.
- For the television credit, use the verified show title only; avoid an unverified episode title/season number until production credit documentation is reconciled.
- State that business ideas still in development are projects in development, not established operating companies.

## Release and safety

- Cloudflare Pages production branch is `site-rebuild-v2`; current production deployment is `b02c7728` at commit `1d5238a8833ce0ea65a24213b57ed97245a498b7`.
- Existing Preview and Production D1 databases are separate. Keep that separation.
- Existing closed form-repair PRs are not to be merged as part of this task; one contains incompatible database assumptions.
- Validate the new feature branch through its Cloudflare Pages preview, source-level checks, route checks, and metadata checks before considering a production merge.
- The current production site remains unchanged until a tested release is ready.
