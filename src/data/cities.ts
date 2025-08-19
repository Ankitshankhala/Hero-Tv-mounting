export const cities = {
  austin: {
    slug: 'austin',
    city: 'Austin',
    state: 'TX',
    fullName: 'Austin, TX',
    pageTitle: 'TV Mounting in Austin, TX | Hero TV Mounting',
    metaDescription: 'Professional TV mounting in Austin with same-day availability, wire concealment, and expert installation. Book online in minutes.',
    neighborhoods: ['Downtown', 'South Congress', 'Domain', 'Zilker', 'East Austin', 'Westlake', 'Cedar Park', 'Round Rock'],
    path: '/locations/austin',
  },
  'san-antonio': {
    slug: 'san-antonio',
    city: 'San Antonio',
    state: 'TX',
    fullName: 'San Antonio, TX',
    pageTitle: 'TV Mounting in San Antonio, TX | Hero TV Mounting',
    metaDescription: 'Expert TV mounting services in San Antonio. Same-day installation, cable management, and professional mounting. Book your service today.',
    neighborhoods: ['Downtown', 'Alamo Heights', 'Stone Oak', 'The Dominion', 'Southtown', 'Medical Center', 'Northeast Side', 'West Side'],
    path: '/locations/san-antonio',
  },
  'fort-worth': {
    slug: 'fort-worth',
    city: 'Fort Worth',
    state: 'TX',
    fullName: 'Fort Worth, TX',
    pageTitle: 'TV Mounting in Fort Worth, TX | Hero TV Mounting',
    metaDescription: 'Reliable TV mounting services in Fort Worth. Professional installation, wire concealment, and same-day availability. Get a quote now.',
    neighborhoods: ['Downtown', 'Cultural District', 'Southside', 'Near Southside', 'Trinity Park', 'Westside', 'North Fort Worth', 'Alliance'],
    path: '/locations/fort-worth',
  },
  dallas: {
    slug: 'dallas',
    city: 'Dallas',
    state: 'TX',
    fullName: 'Dallas, TX',
    pageTitle: 'TV Mounting in Dallas, TX | Hero TV Mounting',
    metaDescription: 'Professional TV mounting in Dallas with expert technicians. Same-day service, cable concealment, and secure installation. Book today.',
    neighborhoods: ['Downtown', 'Uptown', 'Deep Ellum', 'Bishop Arts', 'Preston Center', 'Lakewood', 'Oak Cliff', 'Addison'],
    path: '/locations/dallas',
  },
  houston: {
    slug: 'houston',
    city: 'Houston',
    state: 'TX',
    fullName: 'Houston, TX',
    pageTitle: 'TV Mounting in Houston, TX | Hero TV Mounting',
    metaDescription: 'Top-rated TV mounting services in Houston. Professional installation, wire management, and same-day availability. Schedule your service.',
    neighborhoods: ['Downtown', 'Montrose', 'River Oaks', 'The Heights', 'Galleria', 'Medical Center', 'Sugar Land', 'Katy'],
    path: '/locations/houston',
  },
} as const;

export type CitySlug = keyof typeof cities;

export const getCityBySlug = (slug: string) => {
  return cities[slug as CitySlug] || null;
};

export const getAllCities = () => {
  return Object.values(cities);
};