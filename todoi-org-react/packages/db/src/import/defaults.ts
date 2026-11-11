/**
 * Copy that the open-source page never wrote into its own HTML: app.js held it
 * as defaults, and the commercial page overrode it through #directory-config.
 * Lifted verbatim from todoi-org-website/app.js so the importer can resolve
 * both pages to the same complete shape.
 */
export const APP_DEFAULTS = {
  critTail:
    ' Assessed against the published criteria; the expanded record includes the reasoning and research confidence.',
  crit: {
    avg: {
      head: 'Score',
      title:
        'Unweighted mean of seven scores: the six criteria, each scored 1-5 by reading documentation, repositories and release histories, and community size, its band read as 1 (small) to 5 (very large). An editorial judgement, not a benchmark. Expand a row for all seven and the reasoning behind each one.',
      sr: 'Mean of the six criteria and community size',
    },
    deploy: {
      head: 'Deploy',
      title:
        'Ease of deployment, 1-5: containers and packages, dependency count, operational complexity, upgrade burden and the state of the documentation.',
      sr: 'Ease of deployment',
    },
    use: {
      head: 'Use',
      title:
        'Ease of use, 1-5: interface clarity, learning curve, conceptual overhead, and whether non-specialists can live in it.',
      sr: 'Ease of use',
    },
    enterprise: {
      head: 'Ent',
      title:
        'Enterprise features, 1-5: permissions, identity, audit and governance, portfolio reporting, scalability and administration.',
      sr: 'Enterprise features',
    },
    flex: {
      head: 'Flex',
      title:
        'Interface flexibility, 1-5: how many genuinely useful views exist, plus workflow and custom-field options, dashboards, filters and extension points.',
      sr: 'Interface flexibility',
    },
    sovereignty: {
      head: 'Sov',
      title:
        'Data sovereignty, 1-5: whether you can run it independently, read its source, and keep control of the application and the data under it.',
      sr: 'Data sovereignty',
    },
    portability: {
      head: 'Port',
      title:
        'Portability, 1-5: APIs and exports, conventional storage and database choices, licensing constraints, and how realistically you could leave.',
      sr: 'Portability',
    },
  } as Record<string, { head: string; title: string; sr: string }>,
  toggleNames: {
    tt: 'Time tracking',
    agile: 'Agile boards',
    gantt: 'Gantt',
    calendar: 'Calendar',
    caldav: 'CalDAV',
  } as Record<string, string>,
  toggleToken: 'Native',
  chipToken: 'Licence',
  filterNoun: 'feature and licensing filters',
  empty: {
    search:
      'The search reads names, licences and the one-line descriptions. Try a shorter word, a licence such as MIT or AGPL, or clear it and browse.',
    filtersTitle: 'No project matches those filters',
    filters:
      'Asking for native time tracking, Gantt, a calendar and CalDAV under a single licensing model rules out nearly everything, and partial support never satisfies a must-have. Loosen one filter and try again.',
  },
  lic: {
    foss: 'The assessed software uses a recognised free and open-source licence. Paid hosting, support or GPL-licensed add-ons do not change that classification; FOSS does not mean every feature is available in the free edition.',
    'foss-app':
      'A recognised free licence, but this is an app inside a host platform rather than a product that stands alone. Freedom over the code is full; the dependency you take on is the platform underneath it.',
    'open-core':
      'An open-source core is offered alongside extensions or editions under proprietary or other non-open-source terms. The distinction is the licence of those additions, not whether the free edition feels complete.',
    'source-available':
      'The assessed edition exposes source code under terms that restrict open-source freedoms, such as use, modification or redistribution. Read the licence and edition caveat; visible source and permission to self-host do not by themselves make software open source.',
    'mixed-source':
      'The product’s own code is split: one of the app and its server is open source, the other is restricted or closed. The Source row in the record says which.',
  } as Record<string, string>,
  comm: {
    '5': 'Many active contributors, a busy forum or chat, releases on a steady cadence, and an installed base large enough that almost anything you hit already has a public answer.',
    '4': 'A standing group of contributors, a live support channel and regular releases. Common problems are answered in public; the rarer ones still reach a maintainer.',
    '3': 'A small core team and predictable releases, with a narrower ecosystem around them. Answers exist, mostly in the issue tracker rather than in third-party writing.',
    '2': 'Development held by a few hands, and little written about the project elsewhere. Expect to read the source and open issues rather than find an answer waiting.',
    '1': 'Few contributors and irregular releases. Continuity is a risk you take on yourself.',
  } as Record<string, string>,
  commTail:
    ' Set by contributors, release cadence, forum activity, ecosystem and installed base together - never one metric, and never a count of deployments.',
} as const;
