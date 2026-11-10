const KNOWLEDGE = [
  {
    id: 'about',
    title: 'About Da HoodFarmer',
    url: 'https://dahoodfarmer.com/about',
    keywords: ['about', 'biography', 'bio', 'columbia', 'south carolina', 'certified master farmer', '88-acre', 'farm experience', 'benedict college', 'massanutten', 'second lieutenant', 'wilderness survival', 'beat the odds', 'dr pimple popper', 'holy moly', 'television', 'healing'],
    content: 'Da HoodFarmer is based in Columbia, South Carolina. Public positioning includes Certified Master Farmer, farmer, cowboy, agricultural entrepreneur, and television personality. The website describes hands-on experience across an 88-acre farm operation with rabbits, chickens, ducks, pigs, and horses; Recreation & Leisure Studies at Benedict College; military-school leadership at Massanutten Military Academy in Woodstock, Virginia, including the rank of Second Lieutenant and the Commandant’s Accommodations Medal for helping save two cadets; Senior Wilderness Survival Instructor work; two-time PWC Beat the Odds recognition; and an appearance on Lifetime’s Dr. Pimple Popper, “Holy Moly,” Season 1, Episode 7. The 88-acre reference is experience, not a claim of current ownership.'
  },
  {
    id: 'agriculture',
    title: 'Agriculture & Farm Life',
    url: 'https://dahoodfarmer.com/agriculture',
    keywords: ['agriculture', 'farm', 'livestock', 'animal care', 'animal husbandry', 'soil', 'land stewardship', 'growing', 'crop', 'agricultural education', 'consulting'],
    content: 'The agriculture page describes practical farming experience, responsible animal care, livestock husbandry, daily farm operations, soil health, seasonal planning, water, growing conditions, land stewardship, agricultural education, and potential consulting or collaboration inquiries. It does not publish confirmed service availability, prices, or guaranteed outcomes.'
  },
  {
    id: 'business',
    title: 'Business & Ventures',
    url: 'https://dahoodfarmer.com/business',
    keywords: ['business', 'ventures', 'partnership', 'sponsorship', 'commercial', 'licensing', 'merchandise', 'collaboration', 'agriculture products', 'brand'],
    content: 'The business page describes a developing portfolio around agriculture and farm products, the Healing Ain’t Soft movement, media and television, and community programs. Partnership categories include sponsored content and events, brand collaborations and co-branded products, agricultural and food-industry partnerships, skincare and wellness partnerships, media and production collaborations, licensing, and merchandise. These are inquiry areas, not promises of an active product, signed partnership, or available contract.'
  },
  {
    id: 'media',
    title: 'Television & Media',
    url: 'https://dahoodfarmer.com/media',
    keywords: ['media', 'television', 'tv', 'lifetime', 'dr pimple popper', 'holy moly', 'press', 'interview', 'podcast', 'appearance', 'press kit'],
    content: 'The verified website-listed television credit is Lifetime’s Dr. Pimple Popper, “Holy Moly,” Season 1, Episode 7. The media page invites inquiries for television, podcast, print, digital media, interviews, appearances, and press resources. Direct media professionals to the press kit, contact page, or booking inquiry; do not imply that a future appearance is confirmed.'
  },
  {
    id: 'booking',
    title: 'Speaking & Bookings',
    url: 'https://dahoodfarmer.com/booking',
    keywords: ['booking', 'book', 'speaking', 'event', 'appearance', 'agricultural consulting', 'wilderness survival instruction', 'community event', 'brand partnership', 'sponsorship'],
    content: 'The booking form accepts inquiries for speaking engagements, TV/media appearances, agricultural consulting, wilderness survival instruction, community events, brand partnerships or sponsorships, and other requests. Submitting the form is an inquiry only. Da HoodFarmer responds to discuss details, availability, and pricing; the form does not confirm a booking or establish a price.'
  },
  {
    id: 'shop',
    title: 'Official Store',
    url: 'https://dahoodfarmer.com/shop',
    keywords: ['shop', 'store', 'buy', 'purchase', 'products', 'apparel', 'clothing', 'skincare', 'farm products', 'merchandise', 'price', 'inventory'],
    content: 'The official store page states that the store is in development and that no products are currently available for purchase. Possible future categories include apparel, skincare, and farm products. Product recommendations and prices are not currently published. Visitors can join the newsletter for launch updates or use the contact page for wholesale and partnership inquiries.'
  },
  {
    id: 'community',
    title: 'Community',
    url: 'https://dahoodfarmer.com/community',
    keywords: ['community', 'agricultural literacy', 'youth', 'mentorship', 'volunteer', 'workshop', 'farm visit', 'education', 'wellness', 'outreach'],
    content: 'Community initiatives described on the website include agricultural literacy, farm visits and workshops, wellness awareness, youth mentorship, outdoor education, community events, volunteering, and organizational partnerships. Direct organizations interested in collaboration to the contact page or booking inquiry.'
  },
  {
    id: 'healing',
    title: 'Healing Ain’t Soft',
    url: 'https://dahoodfarmer.com/healing-aint-soft',
    keywords: ['healing', 'healing ain’t soft', "healing ain't soft", 'mens skincare', 'men skincare', 'self-care', 'confidence', 'wellness awareness', 'mental wellness'],
    content: 'Healing Ain’t Soft is described as a men’s skincare, confidence, and wellness-awareness movement. Its themes include self-care, physical health, mental wellness, confidence, and honest conversations about pressures men face. Skincare products and recommendations are in development. The page is not a medical service and does not provide diagnosis or treatment.'
  },
  {
    id: 'contact',
    title: 'Contact',
    url: 'https://dahoodfarmer.com/contact',
    keywords: ['contact', 'email', 'message', 'general inquiry', 'business inquiry', 'media press', 'sponsorship', 'licensing', 'community'],
    content: 'The contact form accepts general inquiries, business or partnership inquiries, media or press requests, speaking or booking requests, sponsorship, licensing, community inquiries, and other messages. Use the booking page for a structured appearance or event request.'
  },
  {
    id: 'press',
    title: 'Official Press Kit',
    url: 'https://dahoodfarmer.com/press-kit',
    keywords: ['press kit', 'short biography', 'extended biography', 'credentials', 'education', 'awards', 'photography', 'media resources'],
    content: 'The press kit provides short and extended biographies and key public facts: Columbia, South Carolina base; Certified Master Farmer, farmer, cowboy, entrepreneur, television personality; 88-acre farm experience and livestock; Recreation & Leisure Studies at Benedict College; Massanutten Military Academy and Second Lieutenant rank; Commandant’s Accommodations Medal; two-time PWC Beat the Odds recognition; Senior Wilderness Survival Instructor; and Lifetime’s Dr. Pimple Popper, “Holy Moly,” Season 1, Episode 7. Photography is described as owner-approved material to be supplied where available and rights permit; do not claim that placeholder images are ready for media use.'
  }
];

const STOP = new Set(['the','and','for','with','what','where','when','how','does','can','you','your','about','from','that','this','are','was','were','who','why','tell','me','please','would','could','should','want','like','have','has','had','get','into','its','their','they','them','there','here']);

export function retrieveKnowledge(message, limit = 3) {
  const query = String(message || '').toLowerCase();
  const terms = (query.match(/[a-z0-9']{3,}/g) || []).filter(term => !STOP.has(term));
  const ranked = KNOWLEDGE.map(doc => {
    const keywordText = doc.keywords.join(' ').toLowerCase();
    const contentText = (doc.title + ' ' + doc.content).toLowerCase();
    let score = 0;
    for (const keyword of doc.keywords) {
      if (query.includes(keyword.toLowerCase())) score += keyword.includes(' ') ? 4 : 3;
    }
    for (const term of terms) {
      if (keywordText.includes(term)) score += 2;
      else if (contentText.includes(term)) score += 1;
    }
    return { ...doc, score };
  }).filter(doc => doc.score > 0).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  return ranked.slice(0, Math.max(1, Math.min(5, limit))).map(({ id, title, url, content }) => ({ id, title, url, content }));
}
