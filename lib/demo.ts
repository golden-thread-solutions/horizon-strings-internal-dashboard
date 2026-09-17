import { defaultSettings, newEvent, type Dataset } from "./model";
import { addDays, businessToday } from "./workflow";

export function demoData(): Dataset {
  const today = businessToday();
  const enquiry = newEvent(
    "Alex & Jordan — sample enquiry",
    addDays(today, -2),
  );
  enquiry.code = "DEMO-001";
  enquiry.revision = 1;
  enquiry.area = "Coffs Harbour";
  enquiry.eventDate = addDays(today, 120);
  const booked = newEvent(
    "Riverside celebration — sample booking",
    addDays(today, -30),
  );
  booked.code = "DEMO-002";
  booked.revision = 1;
  booked.eventDate = addDays(today, 35);
  booked.ensemble = "Trio";
  booked.durationMinutes = 90;
  booked.area = "Bellingen";
  booked.address = "Sample venue address";
  booked.contacts = [
    {
      id: crypto.randomUUID(),
      role: "Main contact",
      name: "Sam Example",
      email: "sam@example.com",
      phone: "",
      notes: "Synthetic demonstration contact",
    },
  ];
  booked.finance = {
    ...booked.finance,
    performance: 1500,
    depositRequired: 400,
    depositReceived: true,
    depositAmount: 400,
    depositDate: addDays(today, -20),
  };
  booked.milestones.responded = addDays(today, -29);
  booked.milestones.welcomeSent = addDays(today, -21);
  booked.details.wetWeather = {
    state: "Deferred",
    value: "Alternative indoor room to be confirmed",
    dueDate: "",
    trigger: "Final Details",
  };
  booked.repertoire = [
    {
      id: crypto.randomUUID(),
      pieceId: "",
      title: "Sample requested piece",
      moment: "Processional",
      status: "Needs arranging",
      notes: "Demonstration only",
    },
  ];
  return {
    events: [enquiry, booked],
    settings: { ...defaultSettings },
    musicians: [],
    pieces: [],
  };
}
