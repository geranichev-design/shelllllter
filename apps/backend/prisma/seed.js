const {
  PrismaClient,
  UserRole,
  OrganizationType,
  ShelterRequestStatus,
  ShelterType,
  AccessType,
  ShelterStatus,
  AccountingStatus,
  RecordStatus,
} = require('@prisma/client');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const envFile = fs.readFileSync(filePath, 'utf8');

  for (const line of envFile.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnv(path.resolve(__dirname, '../.env'));

const prisma = new PrismaClient();

const MEDIA_PALETTES = [
  { sky: '#a7d8f0', wall: '#d8c3a5', wallDark: '#8f7457', accent: '#1f7a8c', door: '#243b53' },
  { sky: '#bcd7ff', wall: '#c9d6c1', wallDark: '#6f8068', accent: '#2563eb', door: '#1f2937' },
  { sky: '#f7d9b8', wall: '#cfd8dc', wallDark: '#697a82', accent: '#b45309', door: '#263238' },
  { sky: '#b7e4d8', wall: '#e0d4bd', wallDark: '#7a6d59', accent: '#0f766e', door: '#334155' },
  { sky: '#d7c4f2', wall: '#d6dde2', wallDark: '#70808d', accent: '#7c3aed', door: '#22223b' },
];

function escapeSvgText(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildShelterPhotoDataUrl({ name, city, role, type, variant }) {
  const palette = MEDIA_PALETTES[variant % MEDIA_PALETTES.length];
  const title = role === 'FACADE' ? 'Фасад укриття' : 'Вхід до укриття';
  const subtitle = role === 'FACADE' ? name : `Вхід · ${city}`;
  const isMobile = type === ShelterType.MOBILE;
  const scene =
    role === 'FACADE'
      ? `
        <rect x="132" y="218" width="936" height="390" rx="12" fill="${palette.wall}"/>
        <rect x="132" y="218" width="936" height="64" fill="${palette.wallDark}" opacity=".92"/>
        <rect x="185" y="326" width="132" height="98" rx="8" fill="#eef6fb" opacity=".9"/>
        <rect x="382" y="326" width="132" height="98" rx="8" fill="#eef6fb" opacity=".9"/>
        <rect x="579" y="326" width="132" height="98" rx="8" fill="#eef6fb" opacity=".9"/>
        <rect x="776" y="326" width="132" height="98" rx="8" fill="#eef6fb" opacity=".9"/>
        <rect x="520" y="438" width="164" height="170" rx="6" fill="${palette.door}"/>
        <rect x="548" y="466" width="108" height="36" rx="18" fill="${palette.accent}"/>
        <rect x="98" y="608" width="1004" height="76" fill="#667085"/>
      `
      : `
        <rect x="214" y="200" width="772" height="456" rx="18" fill="${isMobile ? '#d9e2ec' : palette.wall}"/>
        <rect x="264" y="252" width="672" height="354" rx="12" fill="${isMobile ? '#cbd5e1' : palette.wallDark}" opacity=".9"/>
        <path d="M416 606V388c0-70 58-126 130-126h108c72 0 130 56 130 126v218Z" fill="${palette.door}"/>
        <rect x="462" y="424" width="278" height="54" rx="27" fill="${palette.accent}"/>
        <circle cx="748" cy="504" r="13" fill="#f8fafc"/>
        <rect x="368" y="606" width="464" height="52" fill="#475569"/>
        <rect x="290" y="658" width="620" height="38" fill="#64748b"/>
      `;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800" viewBox="0 0 1200 800">
      <defs>
        <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stop-color="${palette.sky}"/>
          <stop offset="1" stop-color="#f8fafc"/>
        </linearGradient>
        <linearGradient id="shade" x1="0" x2="1">
          <stop offset="0" stop-color="#000" stop-opacity=".18"/>
          <stop offset="1" stop-color="#000" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="1200" height="800" fill="url(#sky)"/>
      <circle cx="1022" cy="124" r="54" fill="#fff7d6"/>
      <path d="M0 612C154 570 306 590 472 622c178 34 346 28 526-22 86-24 148-33 202-28v228H0Z" fill="#78936a" opacity=".65"/>
      ${scene}
      <rect x="132" y="218" width="936" height="390" fill="url(#shade)" opacity=".28"/>
      <rect x="72" y="64" width="492" height="126" rx="18" fill="#111827" opacity=".78"/>
      <text x="104" y="116" fill="#fff" font-family="Inter, Arial, sans-serif" font-size="42" font-weight="700">${escapeSvgText(title)}</text>
      <text x="104" y="158" fill="#d1d5db" font-family="Inter, Arial, sans-serif" font-size="25">${escapeSvgText(subtitle)}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createMediaItem(slug, role, options) {
  const dataUrl = buildShelterPhotoDataUrl({ ...options, role });

  return {
    id: `${slug}-${role.toLowerCase()}`,
    name: role === 'FACADE' ? `${options.name} — фасад` : `${options.name} — вхід`,
    dataUrl,
    mimeType: 'image/svg+xml',
    size: Buffer.byteLength(dataUrl, 'utf8'),
    role,
  };
}

function shelterMedia(slug, options) {
  return [
    createMediaItem(slug, 'FACADE', options),
    createMediaItem(slug, 'ENTRANCE', options),
  ];
}

async function main() {
  const seedPassword = process.env.DEMO_SEED_PASSWORD || randomBytes(18).toString('base64url');

  await prisma.inspection.deleteMany();
  await prisma.shelter.deleteMany();
  await prisma.shelterRequest.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();

  // ── Організації ──────────────────────────────────────────────────────────
  const dsnsMain = await prisma.organization.create({
    data: { name: 'ДСНС України (Центральний апарат)', type: OrganizationType.DSNS },
  });

  const kyivRegional = await prisma.organization.create({
    data: { name: 'Київська обласна адміністрація', type: OrganizationType.REGIONAL },
  });

  const lvivRegional = await prisma.organization.create({
    data: { name: 'Львівська обласна адміністрація', type: OrganizationType.REGIONAL },
  });

  const kharkivRegional = await prisma.organization.create({
    data: { name: 'Харківська обласна адміністрація', type: OrganizationType.REGIONAL },
  });

  const kyivDept = await prisma.organization.create({
    data: {
      name: 'Департамент цивільного захисту м. Київ',
      type: OrganizationType.DEPARTMENT,
      parentId: kyivRegional.id,
    },
  });

  const lvivDept = await prisma.organization.create({
    data: {
      name: 'Управління цивільного захисту м. Львів',
      type: OrganizationType.DEPARTMENT,
      parentId: lvivRegional.id,
    },
  });

  const kharkivDept = await prisma.organization.create({
    data: {
      name: 'Відділ цивільного захисту м. Харків',
      type: OrganizationType.DEPARTMENT,
      parentId: kharkivRegional.id,
    },
  });

  // ── Користувачі ──────────────────────────────────────────────────────────
  const password = await bcrypt.hash(seedPassword, 10);

  const [
    balanceHolder1,
    balanceHolder2,
    balanceHolder3,
    govOrg1,
    govOrg2,
    regional1,
    regional2,
    regional3,
    dsnsUser,
  ] = await Promise.all([
    prisma.user.create({
      data: { email: 'balance-holder@example.com', password, role: UserRole.BALANCE_HOLDER, orgId: kyivDept.id },
    }),
    prisma.user.create({
      data: { email: 'balance-holder2@example.com', password, role: UserRole.BALANCE_HOLDER, orgId: lvivDept.id },
    }),
    prisma.user.create({
      data: { email: 'balance-holder3@example.com', password, role: UserRole.BALANCE_HOLDER, orgId: kharkivDept.id },
    }),
    prisma.user.create({
      data: { email: 'gov-org@example.com', password, role: UserRole.GOV_ORG, orgId: kyivDept.id },
    }),
    prisma.user.create({
      data: { email: 'gov-org2@example.com', password, role: UserRole.GOV_ORG, orgId: lvivDept.id },
    }),
    prisma.user.create({
      data: { email: 'regional@example.com', password, role: UserRole.REGIONAL, orgId: kyivRegional.id },
    }),
    prisma.user.create({
      data: { email: 'regional-lviv@example.com', password, role: UserRole.REGIONAL, orgId: lvivRegional.id },
    }),
    prisma.user.create({
      data: { email: 'regional-kharkiv@example.com', password, role: UserRole.REGIONAL, orgId: kharkivRegional.id },
    }),
    prisma.user.create({
      data: { email: 'dsns@example.com', password, role: UserRole.DSNS, orgId: dsnsMain.id },
    }),
  ]);

  // ── Заявки на укриття ─────────────────────────────────────────────────────

  // 1. Нові (NEW) — очікують розгляду
  const newRequests = await Promise.all([
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder1.id,
        status: ShelterRequestStatus.NEW,
        data: {
          name: 'Підвал ЗОШ №45',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 320,
          latitude: 50.4501,
          longitude: 30.5234,
          address: 'м. Київ, вул. Хрещатик, 1',
          description: 'Підвальне приміщення школи, обладнане засобами захисту',
          ownerOrgId: kyivDept.id,
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder1.id,
        status: ShelterRequestStatus.NEW,
        data: {
          name: 'Паркінг ТРЦ «Гулівер»',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 850,
          latitude: 50.4432,
          longitude: 30.5069,
          address: 'м. Київ, вул. Спортивна пл., 1В',
          description: 'Підземний паркінг, придатний для укриття цивільного населення',
          ownerOrgId: kyivDept.id,
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: govOrg1.id,
        status: ShelterRequestStatus.NEW,
        data: {
          name: 'Метро «Арсенальна» (вестибюль)',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 1200,
          latitude: 50.4484,
          longitude: 30.5435,
          address: 'м. Київ, пл. Арсенальна, 1',
          description: 'Станція метрополітену, глибина 105 м',
          ownerOrgId: kyivDept.id,
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder2.id,
        status: ShelterRequestStatus.NEW,
        data: {
          name: 'Підвал бібліотеки ім. Франка',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 180,
          latitude: 49.8395,
          longitude: 24.0283,
          address: 'м. Львів, пр. Свободи, 15',
          description: 'Підвальне приміщення міської бібліотеки',
          ownerOrgId: lvivDept.id,
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder3.id,
        status: ShelterRequestStatus.NEW,
        data: {
          name: 'Укриття у підвалі адмінбудівлі',
          type: ShelterType.STATIC,
          accessType: AccessType.PRIVATE,
          capacity: 60,
          latitude: 49.9935,
          longitude: 36.2304,
          address: 'м. Харків, пл. Свободи, 5',
          description: 'Службове приміщення, доступ за перепустками',
          ownerOrgId: kharkivDept.id,
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: govOrg2.id,
        status: ShelterRequestStatus.NEW,
        data: {
          name: 'Мобільний модуль «Захист-1»',
          type: ShelterType.MOBILE,
          accessType: AccessType.PUBLIC,
          capacity: 45,
          latitude: 49.8397,
          longitude: 24.0323,
          address: 'м. Львів, вул. Городоцька, 1',
          description: 'Мобільний захисний модуль, розгортається за 30 хв',
          ownerOrgId: lvivDept.id,
        },
      },
    }),
  ]);

  // 2. Схвалені (APPROVED) — стають укриттями PENDING
  const approvedRequests = await Promise.all([
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder1.id,
        reviewedById: regional1.id,
        status: ShelterRequestStatus.APPROVED,
        reviewedAt: new Date('2024-12-10T09:30:00Z'),
        data: {
          name: 'Підземний перехід «Майдан»',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 600,
          latitude: 50.4501,
          longitude: 30.5240,
          address: 'м. Київ, Майдан Незалежності',
          description: 'Підземний пішохідний перехід зі стаціонарним обладнанням',
          ownerOrgId: kyivDept.id,
          media: shelterMedia('maidan-crossing', {
            name: 'Підземний перехід «Майдан»',
            city: 'Київ',
            type: ShelterType.STATIC,
            variant: 0,
          }),
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: govOrg1.id,
        reviewedById: regional1.id,
        status: ShelterRequestStatus.APPROVED,
        reviewedAt: new Date('2024-12-15T14:00:00Z'),
        data: {
          name: 'Укриття «Поштова площа»',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 400,
          latitude: 50.4576,
          longitude: 30.5184,
          address: 'м. Київ, Поштова площа, 2',
          description: 'Капітальне підземне укриття',
          ownerOrgId: kyivDept.id,
          media: shelterMedia('poshtova-square', {
            name: 'Укриття «Поштова площа»',
            city: 'Київ',
            type: ShelterType.STATIC,
            variant: 1,
          }),
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder2.id,
        reviewedById: regional2.id,
        status: ShelterRequestStatus.APPROVED,
        reviewedAt: new Date('2025-01-05T11:00:00Z'),
        data: {
          name: 'Підвал Ратуші',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 250,
          latitude: 49.8423,
          longitude: 24.0319,
          address: 'м. Львів, пл. Ринок, 1',
          description: 'Підвальне приміщення Ратуші, укріплені стіни',
          ownerOrgId: lvivDept.id,
          media: shelterMedia('lviv-ratusha-basement', {
            name: 'Підвал Ратуші',
            city: 'Львів',
            type: ShelterType.STATIC,
            variant: 2,
          }),
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder3.id,
        reviewedById: regional3.id,
        status: ShelterRequestStatus.APPROVED,
        reviewedAt: new Date('2025-01-20T10:15:00Z'),
        data: {
          name: 'Метро «Держпром»',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 900,
          latitude: 49.9934,
          longitude: 36.2311,
          address: 'м. Харків, пл. Свободи, 1',
          description: 'Станція метрополітену глибокого залягання',
          ownerOrgId: kharkivDept.id,
          media: shelterMedia('derzhprom-metro', {
            name: 'Метро «Держпром»',
            city: 'Харків',
            type: ShelterType.STATIC,
            variant: 3,
          }),
        },
      },
    }),
  ]);

  // 3. Відхилені (REJECTED)
  await Promise.all([
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder1.id,
        reviewedById: regional1.id,
        status: ShelterRequestStatus.REJECTED,
        rejectionReason: 'Приміщення не відповідає нормам ДСТУ 4997:2008 — недостатня висота стелі (менше 2.0 м)',
        reviewedAt: new Date('2024-11-20T16:45:00Z'),
        data: {
          name: 'Підвал житлового будинку на Лесі Українки',
          type: ShelterType.STATIC,
          accessType: AccessType.PRIVATE,
          capacity: 40,
          latitude: 50.4221,
          longitude: 30.5337,
          address: 'м. Київ, бул. Лесі Українки, 26',
          description: 'Підвал старого будинку',
          ownerOrgId: kyivDept.id,
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: govOrg2.id,
        reviewedById: regional2.id,
        status: ShelterRequestStatus.REJECTED,
        rejectionReason: 'Відсутні документи про право власності та технічний паспорт приміщення',
        reviewedAt: new Date('2025-01-10T13:20:00Z'),
        data: {
          name: 'Склад на Городоцькій',
          type: ShelterType.STATIC,
          accessType: AccessType.PRIVATE,
          capacity: 70,
          latitude: 49.8350,
          longitude: 23.9830,
          address: 'м. Львів, вул. Городоцька, 188',
          description: 'Складське приміщення, потребує переобладнання',
          ownerOrgId: lvivDept.id,
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder3.id,
        reviewedById: regional3.id,
        status: ShelterRequestStatus.REJECTED,
        rejectionReason: 'Розташовано у зоні підтоплення, не придатне для використання як укриття',
        reviewedAt: new Date('2025-02-03T09:00:00Z'),
        data: {
          name: 'Підвальне приміщення на Клочківській',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 110,
          latitude: 49.9812,
          longitude: 36.2150,
          address: 'м. Харків, вул. Клочківська, 192',
          description: 'Підвал комунальної будівлі',
          ownerOrgId: kharkivDept.id,
        },
      },
    }),
  ]);

  const existingShelterRequests = await Promise.all([
    prisma.shelterRequest.create({
      data: {
        createdById: govOrg1.id,
        reviewedById: regional1.id,
        status: ShelterRequestStatus.APPROVED,
        reviewedAt: new Date('2025-02-12T09:00:00Z'),
        data: {
          name: 'Бомбосховище «Університет»',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 1500,
          latitude: 50.4338,
          longitude: 30.5197,
          address: 'м. Київ, вул. Володимирська, 60',
          description: 'Капітальне бомбосховище в університетському кварталі',
          ownerOrgId: kyivDept.id,
          media: shelterMedia('university-shelter', {
            name: 'Бомбосховище «Університет»',
            city: 'Київ',
            type: ShelterType.STATIC,
            variant: 4,
          }),
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder2.id,
        reviewedById: regional2.id,
        status: ShelterRequestStatus.APPROVED,
        reviewedAt: new Date('2025-02-18T12:30:00Z'),
        data: {
          name: 'Підземна парковка «Форум Львів»',
          type: ShelterType.STATIC,
          accessType: AccessType.PUBLIC,
          capacity: 380,
          latitude: 49.837,
          longitude: 24.046,
          address: 'м. Львів, вул. Під Дубом, 7Б',
          description: 'Підземний паркінг торговельного центру, частково потребує ремонту',
          ownerOrgId: lvivDept.id,
          media: shelterMedia('forum-lviv-parking', {
            name: 'Підземна парковка «Форум Львів»',
            city: 'Львів',
            type: ShelterType.STATIC,
            variant: 1,
          }),
        },
      },
    }),
    prisma.shelterRequest.create({
      data: {
        createdById: balanceHolder3.id,
        reviewedById: regional3.id,
        status: ShelterRequestStatus.APPROVED,
        reviewedAt: new Date('2025-03-01T10:45:00Z'),
        data: {
          name: 'Модульне укриття «Салтівка-1»',
          type: ShelterType.MOBILE,
          accessType: AccessType.PUBLIC,
          capacity: 120,
          latitude: 49.9975,
          longitude: 36.3572,
          address: 'м. Харків, Салтівський район, квартал 520',
          description: 'Модульне укриття швидкого розгортання',
          ownerOrgId: kharkivDept.id,
          media: shelterMedia('saltivka-module-1', {
            name: 'Модульне укриття «Салтівка-1»',
            city: 'Харків',
            type: ShelterType.MOBILE,
            variant: 3,
          }),
        },
      },
    }),
  ]);

  // ── Укриття ──────────────────────────────────────────────────────────────
  await Promise.all([
    prisma.shelter.create({
      data: {
        name: 'Підземний перехід «Майдан»',
        type: ShelterType.STATIC,
        accessType: AccessType.PUBLIC,
        capacity: 600,
        latitude: 50.4501,
        longitude: 30.524,
        status: ShelterStatus.NEED,
        accountingStatus: AccountingStatus.ACCOUNTED,
        recordStatus: RecordStatus.ACTIVE,
        ownerOrgId: kyivDept.id,
        sourceRequestId: approvedRequests[0].id,
      },
    }),
    prisma.shelter.create({
      data: {
        name: 'Укриття «Поштова площа»',
        type: ShelterType.STATIC,
        accessType: AccessType.PUBLIC,
        capacity: 400,
        latitude: 50.4576,
        longitude: 30.5184,
        status: ShelterStatus.PROJECT,
        accountingStatus: AccountingStatus.IN_PROGRESS,
        recordStatus: RecordStatus.ACTIVE,
        ownerOrgId: kyivDept.id,
        sourceRequestId: approvedRequests[1].id,
      },
    }),
    prisma.shelter.create({
      data: {
        name: 'Бомбосховище «Університет»',
        type: ShelterType.STATIC,
        accessType: AccessType.PUBLIC,
        capacity: 1500,
        latitude: 50.4338,
        longitude: 30.5197,
        status: ShelterStatus.OPERATION,
        accountingStatus: AccountingStatus.ACCOUNTED,
        recordStatus: RecordStatus.ACTIVE,
        ownerOrgId: kyivDept.id,
        sourceRequestId: existingShelterRequests[0].id,
      },
    }),
    prisma.shelter.create({
      data: {
        name: 'Підземна парковка «Форум Львів»',
        type: ShelterType.STATIC,
        accessType: AccessType.PUBLIC,
        capacity: 380,
        latitude: 49.837,
        longitude: 24.046,
        status: ShelterStatus.REPAIR,
        accountingStatus: AccountingStatus.ACCOUNTED,
        recordStatus: RecordStatus.SUSPENDED,
        ownerOrgId: lvivDept.id,
        sourceRequestId: existingShelterRequests[1].id,
      },
    }),
    prisma.shelter.create({
      data: {
        name: 'Модульне укриття «Салтівка-1»',
        type: ShelterType.MOBILE,
        accessType: AccessType.PUBLIC,
        capacity: 120,
        latitude: 49.9975,
        longitude: 36.3572,
        status: ShelterStatus.NEED,
        accountingStatus: AccountingStatus.NEW,
        recordStatus: RecordStatus.DRAFT,
        ownerOrgId: kharkivDept.id,
        sourceRequestId: existingShelterRequests[2].id,
      },
    }),
  ]);

  console.log('✅ Seed завершено успішно');
  console.log('');
  console.log('👤 Тестові облікові записи:');
  console.log('Пароль для тестових облікових записів:', seedPassword);
  console.log('  balance-holder@example.com  — BALANCE_HOLDER (Київ)');
  console.log('  balance-holder2@example.com — BALANCE_HOLDER (Львів)');
  console.log('  balance-holder3@example.com — BALANCE_HOLDER (Харків)');
  console.log('  gov-org@example.com         — GOV_ORG        (Київ)');
  console.log('  gov-org2@example.com        — GOV_ORG        (Львів)');
  console.log('  regional@example.com        — REGIONAL       (Київ)');
  console.log('  regional-lviv@example.com   — REGIONAL       (Львів)');
  console.log('  regional-kharkiv@example.com— REGIONAL       (Харків)');
  console.log('  dsns@example.com            — DSNS           (Центральний апарат)');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
