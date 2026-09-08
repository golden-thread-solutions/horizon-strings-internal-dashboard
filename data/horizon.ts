export type EventStage =
  | "New"
  | "Qualifying"
  | "Quote Sent"
  | "Booking Pending"
  | "Booked"
  | "Planning"
  | "Ready"
  | "Completed"
  | "Closed";

export type TaskStatus = "Not started" | "In progress" | "Done" | "Blocked";
export type TaskSource = "Workflow" | "Manual" | "Finance" | "Musicians" | "Repertoire";
export type TaskPriority = "High" | "Medium" | "Low";

export type WorkflowSettings = {
  defaultDepositAmount: number;
  musiciansSortedDaysBeforeEvent: number;
  setlistSortedDaysBeforeEvent: number;
  finalInvoiceLeadDays: number;
  reviewRequestDaysAfterEvent: number;
};

export type HorizonTask = {
  id: string;
  externalTaskId?: string;
  eventId?: string;
  title: string;
  stage?: string;
  status: TaskStatus;
  dueDate?: string;
  source: TaskSource;
  priority: TaskPriority;
  assignee?: string;
  category?: string;
  urgency?: number;
  dueBasis?: string;
  offsetDays?: number;
  notes?: string;
};

export type EventContact = {
  role: string;
  name?: string;
  phone?: string;
  email?: string;
  notes?: string;
};

export type MusicianBooking = {
  name: string;
  instrument: string;
  finalised?: boolean;
  confirmed: boolean;
  musicSent: boolean;
  contractSent?: boolean;
  signed: boolean;
  paid: boolean;
  notes?: string;
};

export type RepertoireRequest = {
  moment: string;
  piece?: string;
  status: "Unknown" | "Requested" | "Available" | "Needs arranging" | "Approved" | "N/A";
  notes?: string;
};

export type FinanceSummary = {
  quotedAmount: number;
  depositRequired: number;
  depositInvoiceSent: boolean;
  depositReceived: number;
  finalInvoiceSent: boolean;
  finalPaid: boolean;
  musicianCosts: number;
  otherCosts: number;
};

export type EventRecord = {
  id: string;
  sourceSheetId?: number;
  sourceSheetName?: string;
  firstName?: string;
  clientName: string;
  sheetName: string;
  eventDate?: string;
  eventType: string;
  stage: EventStage;
  active?: boolean;
  archived: boolean;
  archiveNonSale?: boolean;
  sheetCreated?: boolean;
  source: string;
  createdDate: string;
  lastRefresh: string;
  progression?: {
    contactMedium?: string;
    heardAboutUs?: string;
    enquiryDetails?: string;
    enquiryNotes?: string;
    callTimeConfirmed?: boolean;
    musicInDrive?: boolean;
  };
  mainDetails: {
    playingMinutes?: number;
    ensemble?: string;
    day?: string;
    notes?: string;
  };
  contacts: EventContact[];
  timings: {
    arrivalTime?: string;
    preCeremony?: string;
    playStart?: string;
    ceremonyStart?: string;
    ceremonyDuration?: string;
    remainingTime?: string;
  };
  location: {
    area?: string;
    address?: string;
    details?: string;
    inOutside?: string;
    wetWeatherArea?: string;
    wetWeatherAddress?: string;
    wetWeatherDetails?: string;
    wetWeatherLocationChange?: string;
    rainCallTime?: string;
    secondAddressRequired?: string;
    secondAddressDetails?: string;
  };
  couple?: {
    bride?: string;
    groom?: string;
    other?: string;
  };
  logistics: Record<string, string>;
  musicians: MusicianBooking[];
  repertoire: RepertoireRequest[];
  finance: FinanceSummary;
  communicationLog: {
    label: string;
    date?: string;
    notes?: string;
    done: boolean;
  }[];
  tasks: HorizonTask[];
};

export const workflowSettings: WorkflowSettings = {
  defaultDepositAmount: 400,
  musiciansSortedDaysBeforeEvent: 92,
  setlistSortedDaysBeforeEvent: 42,
  finalInvoiceLeadDays: 14,
  reviewRequestDaysAfterEvent: 7
};

export const events: EventRecord[] = [
  {
    id: "E9001",
    sourceSheetName: "Sample Enquiry - E9001",
    firstName: "Alex",
    clientName: "Alex Sample",
    sheetName: "Sample Enquiry - E9001",
    eventDate: "2026-11-21",
    eventType: "Wedding",
    stage: "New",
    active: true,
    archived: false,
    archiveNonSale: false,
    sheetCreated: true,
    source: "Dummy data",
    createdDate: "2026-09-01",
    lastRefresh: "2026-09-01T10:00:00+10:00",
    progression: {
      contactMedium: "Website enquiry",
      heardAboutUs: "Google",
      enquiryDetails: "Asked about ceremony and cocktail hour music.",
      callTimeConfirmed: false,
      musicInDrive: false
    },
    mainDetails: {
      playingMinutes: 90,
      ensemble: "Quartet",
      day: "Saturday"
    },
    contacts: [
      {
        role: "Main contact",
        name: "Alex Sample",
        phone: "Sample phone",
        email: "Sample email"
      },
      { role: "On the day contact" },
      { role: "Celebrant" }
    ],
    timings: {
      remainingTime: "90"
    },
    location: {
      area: "Coffs Harbour",
      inOutside: "Outside",
      wetWeatherArea: "TBD",
      rainCallTime: "TBD"
    },
    logistics: {
      "Secret signal": "",
      Chairs: "",
      "Dress code": "",
      Shelter: "Needs confirmation",
      Amplification: "",
      "Guest count": "90",
      Rehearsal: ""
    },
    musicians: [],
    repertoire: [
      { moment: "Processional", status: "Unknown" },
      { moment: "Register signing", status: "Unknown" },
      { moment: "Recessional", status: "Unknown" }
    ],
    finance: {
      quotedAmount: 0,
      depositRequired: workflowSettings.defaultDepositAmount,
      depositInvoiceSent: false,
      depositReceived: 0,
      finalInvoiceSent: false,
      finalPaid: false,
      musicianCosts: 0,
      otherCosts: 0
    },
    communicationLog: [
      { label: "Enquiry", done: true, date: "2026-09-01" },
      { label: "Primary call", done: false },
      { label: "Deposit sent", done: false },
      { label: "Deposit received", done: false }
    ],
    tasks: [
      {
        id: "T-E9001-1",
        externalTaskId: "T9001",
        eventId: "E9001",
        stage: "First contact",
        title: "Respond to enquiry",
        status: "Not started",
        dueDate: "2026-09-01",
        source: "Workflow",
        priority: "High",
        assignee: "Koby",
        category: "Communication",
        urgency: 10,
        notes: "Same-day response target."
      }
    ]
  },
  {
    id: "E9002",
    sourceSheetName: "Sample Booked - E9002",
    firstName: "Jordan",
    clientName: "Jordan Example",
    sheetName: "Sample Booked - E9002",
    eventDate: "2027-03-14",
    eventType: "Wedding",
    stage: "Booked",
    active: true,
    archived: false,
    archiveNonSale: false,
    sheetCreated: true,
    source: "Dummy data",
    createdDate: "2026-08-15",
    lastRefresh: "2026-09-01T10:00:00+10:00",
    progression: {
      contactMedium: "Email",
      heardAboutUs: "Venue referral",
      callTimeConfirmed: true,
      musicInDrive: false
    },
    mainDetails: {
      playingMinutes: 120,
      ensemble: "Quartet",
      day: "Sunday"
    },
    contacts: [
      {
        role: "Main contact",
        name: "Jordan Example",
        phone: "Sample phone",
        email: "Sample email"
      },
      {
        role: "On the day contact",
        name: "Taylor Contact",
        phone: "Sample phone"
      }
    ],
    timings: {
      arrivalTime: "2:00 pm",
      playStart: "2:30 pm",
      ceremonyStart: "3:00 pm",
      ceremonyDuration: "30",
      remainingTime: "60"
    },
    location: {
      area: "Byron Bay",
      address: "Sample venue address",
      inOutside: "Inside",
      wetWeatherArea: "N/A"
    },
    couple: {
      bride: "Jordan",
      groom: "Riley"
    },
    logistics: {
      "Secret signal": "Planner cue",
      Chairs: "4",
      "Dress code": "Black formal",
      Shelter: "N/A",
      Amplification: "Not required",
      "Guest count": "120",
      Rehearsal: "TBD"
    },
    musicians: [
      {
        name: "Sample violinist",
        instrument: "Violin",
        finalised: true,
        confirmed: true,
        musicSent: false,
        contractSent: true,
        signed: false,
        paid: false
      },
      {
        name: "Sample cellist",
        instrument: "Cello",
        finalised: true,
        confirmed: true,
        musicSent: false,
        contractSent: true,
        signed: false,
        paid: false
      }
    ],
    repertoire: [
      { moment: "Processional", piece: "Sample classical piece", status: "Available" },
      { moment: "Signing", piece: "Sample film theme", status: "Requested" },
      { moment: "Recessional", piece: "Sample modern song", status: "Needs arranging" }
    ],
    finance: {
      quotedAmount: 1800,
      depositRequired: workflowSettings.defaultDepositAmount,
      depositInvoiceSent: true,
      depositReceived: 400,
      finalInvoiceSent: false,
      finalPaid: false,
      musicianCosts: 800,
      otherCosts: 0
    },
    communicationLog: [
      { label: "Deposit sent", done: true, date: "2026-08-16" },
      { label: "Deposit received", done: true, date: "2026-08-18" }
    ],
    tasks: [
      {
        id: "T-E9002-1",
        externalTaskId: "T9002",
        eventId: "E9002",
        title: "Confirm remaining ceremony music",
        status: "In progress",
        dueDate: "2027-01-31",
        source: "Repertoire",
        priority: "Medium",
        assignee: "Koby",
        category: "Setlist",
        urgency: 6
      }
    ]
  },
  {
    id: "E9003",
    sourceSheetName: "Sample Completed - E9003",
    firstName: "Morgan",
    clientName: "Morgan Demo",
    sheetName: "Sample Completed - E9003",
    eventDate: "2026-08-22",
    eventType: "Corporate",
    stage: "Completed",
    active: true,
    archived: false,
    archiveNonSale: false,
    sheetCreated: true,
    source: "Dummy data",
    createdDate: "2026-06-10",
    lastRefresh: "2026-09-01T10:00:00+10:00",
    mainDetails: {
      playingMinutes: 60,
      ensemble: "Trio",
      day: "Saturday"
    },
    contacts: [
      {
        role: "Main contact",
        name: "Morgan Demo",
        phone: "Sample phone",
        email: "Sample email"
      }
    ],
    timings: {
      arrivalTime: "5:30 pm",
      playStart: "6:00 pm",
      remainingTime: "60"
    },
    location: {
      area: "Newcastle",
      address: "Sample function centre",
      inOutside: "Inside"
    },
    logistics: {
      Chairs: "3",
      "Dress code": "Formal",
      Shelter: "N/A",
      "Guest count": "80"
    },
    musicians: [
      {
        name: "Sample violist",
        instrument: "Viola",
        finalised: true,
        confirmed: true,
        musicSent: true,
        signed: true,
        paid: false
      }
    ],
    repertoire: [
      { moment: "Background set", piece: "Sample reception set", status: "Approved" }
    ],
    finance: {
      quotedAmount: 1200,
      depositRequired: workflowSettings.defaultDepositAmount,
      depositInvoiceSent: true,
      depositReceived: 400,
      finalInvoiceSent: true,
      finalPaid: false,
      musicianCosts: 500,
      otherCosts: 50
    },
    communicationLog: [
      { label: "Final invoice sent", done: true, date: "2026-08-23" }
    ],
    tasks: [
      {
        id: "T-E9003-1",
        eventId: "E9003",
        title: "Check final payment and close event",
        status: "Not started",
        dueDate: "2026-08-29",
        source: "Finance",
        priority: "High",
        assignee: "Koby",
        category: "Finance",
        urgency: 8
      },
      {
        id: "T-E9003-2",
        eventId: "E9003",
        title: "Send review request",
        status: "Not started",
        dueDate: "2026-08-29",
        source: "Workflow",
        priority: "Medium",
        assignee: "Koby",
        category: "Communication",
        urgency: 5
      }
    ]
  }
];

export const musicians = [
  { name: "Sample violinist", instrument: "Violin", status: "Active", notes: "Dummy roster member." },
  { name: "Sample violist", instrument: "Viola", status: "Active", notes: "Dummy roster member." },
  { name: "Sample cellist", instrument: "Cello", status: "Active", notes: "Dummy roster member." }
];

export const processRules = [
  "Maintain same-day response policy unless the message arrives after hours.",
  "Deposit invoice sent and deposit received are key booking checkpoints.",
  `A ${workflowSettings.defaultDepositAmount.toLocaleString("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 })} deposit is the current default placeholder.`,
  "Full payment should be received two weeks before the event.",
  `Setlist sorted checkpoint is due ${workflowSettings.setlistSortedDaysBeforeEvent} days before the event.`,
  `Musicians sorted checkpoint is due ${workflowSettings.musiciansSortedDaysBeforeEvent} days before the event.`,
  "Organise rehearsals for musicians two weeks in advance with times.",
  "Do not schedule rehearsals one hour before leave time for a gig.",
  "Performers need correct dress code, instrument, music, water bottle, stand, and 30-minute early arrival.",
  "Outdoor events need rain contingency and shelter clarity.",
  "Client setlists should allow additions; do not silently remove disliked pieces."
];
