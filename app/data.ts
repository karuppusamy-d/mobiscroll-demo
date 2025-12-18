export type FlightMovement = {
  ac_reg_no: string;
  actype_icao: string;
  flight_no: number;
  flight_nature: string;
  sto: number;
  flight_leg_id: string;
  airline: {
    airline_iata: string;
  };
  gate_allocations: {
    id: string;
    gate_id: string;
    allocation_start: number;
    allocation_end: number;
  }[];
};

export type Gate = {
  gate_name: string;
  alias: string;
  gate_id: string;
  terminal: {
    alias: string;
    terminal_name: string;
    terminal_id: string;
  };
  downtimes: {
    start_time: string;
    end_time: string;
    maintenance_type: string;
  }[];
};

export const data: FlightMovement[] = [
  {
    ac_reg_no: "AI-1234",
    actype_icao: "A320",
    flight_no: 7413,
    flight_nature: "departure",
    sto: new Date("2025-12-18T14:00:00").getTime(),
    flight_leg_id: "10634cd4-f0d4-414e-8825-e8875c0dcf90",
    airline: {
      airline_iata: "AI",
    },
    gate_allocations: [
      {
        id: "74c30915-7c21-4d3e-99ff-668384c76860",
        gate_id: "g1",
        allocation_start: new Date("2025-12-18T14:00:00").getTime(),
        allocation_end: new Date("2025-12-18T15:00:00").getTime(),
      },
    ],
  },
  {
    ac_reg_no: "AI-1235",
    actype_icao: "A320",
    flight_no: 7414,
    flight_nature: "departure",
    sto: new Date("2025-12-18T15:00:00").getTime(),
    flight_leg_id: "10634cd4-f0d4-414e-8825-e8875c0dcf91",
    airline: {
      airline_iata: "AI",
    },
    gate_allocations: [
      {
        id: "74c30915-7c21-4d3e-99ff-668384c76861",
        gate_id: "g2",
        allocation_start: new Date("2025-12-18T15:00:00").getTime(),
        allocation_end: new Date("2025-12-18T16:00:00").getTime(),
      },
    ],
  },
] as const;

export const gates: Gate[] = [
  {
    gate_name: "G1",
    alias: "G1",
    gate_id: "g1",
    terminal: {
      alias: "T1 Domestic",
      terminal_name: "Terminal 1",
      terminal_id: "t1",
    },
    downtimes: [
      {
        start_time: "2025-12-18T10:00:00",
        end_time: "2025-12-18T12:00:00",
        maintenance_type: "Maintenance",
      },
    ],
  },
  {
    gate_name: "G2",
    alias: "G2",
    gate_id: "g2",
    terminal: {
      alias: "T2 Domestic",
      terminal_name: "Terminal 2",
      terminal_id: "t2",
    },
    downtimes: [
      {
        start_time: "2025-12-18T10:00:00",
        end_time: "2025-12-18T12:00:00",
        maintenance_type: "Maintenance",
      },
    ],
  },
  {
    gate_name: "G3",
    alias: "G3",
    gate_id: "g3",
    terminal: {
      alias: "T3 Domestic",
      terminal_name: "Terminal 3",
      terminal_id: "t3",
    },
    downtimes: [],
  },
  {
    gate_name: "G4",
    alias: "G4",
    gate_id: "g4",
    terminal: {
      alias: "T3 Domestic",
      terminal_name: "Terminal 3",
      terminal_id: "t3",
    },
    downtimes: [],
  },
] as const;
