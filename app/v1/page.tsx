"use client";

import {
  Eventcalendar,
  MbscCalendarEvent,
  MbscCalendarEventData,
  MbscDateType,
  MbscEventClickEvent,
  MbscEventUpdateEvent,
  MbscEventcalendarView,
  MbscResource,
  Popup,
  momentTimezone,
  setOptions,
} from "@mobiscroll/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isToday, sub } from "date-fns";
import moment from "moment-timezone";
import { twJoin } from "tailwind-merge";
import { FlightMovement, data, gates } from "../data";

// import "@mobiscroll/react/dist/css/mobiscroll.min.css";
import "../mobiscroll.css";

type GateAllocation = {
  id: string;
  flight_leg_id: string;
  allocation_start: number;
  allocation_end: number;
  gate_id: string | null;
};

type ZoomLevel = "50" | "100" | "125" | "150";

setOptions({
  theme: "ios",
  themeVariant: "dark",
});
momentTimezone.moment = moment;

function getTimeStepForZoom(zoomLevel: ZoomLevel) {
  // Specifies the step of the grid cells in minutes. Supported values: 1, 5, 10, 15, 20, 30, 60, 120, 180, 240, 360, 480, 720, 1440

  switch (zoomLevel) {
    case "50":
      return 60;

    case "100":
      return 30;

    case "125":
      return 15;

    case "150":
      return 10;

    default:
      return 10;
  }
}

export default function GatesPage() {
  const [startTime] = useState(new Date("2025-12-18T00:00:00").getTime());
  const [endTime] = useState(new Date("2025-12-18T23:59:59").getTime());
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("125");

  const [time, setTime] = useState(new Date().getTime());
  useEffect(() => {
    const timerID = setInterval(() => {
      console.log("Updating time");
      setTime(new Date().getTime());
    }, 60_000);

    // returning a cleanup function
    return function cleanup() {
      clearInterval(timerID);
    };
  }, []);

  const displayTimezone = useMemo(() => {
    const isUTC = true;
    return isUTC ? "utc" : "Asia/Kolkata";
  }, []);

  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Tooltip
  const [tooltipFlightLegId, setTooltipFlightLegId] = useState<string | null>(
    null
  );
  const [tooltipAnchor, setTooltipAnchor] = useState<HTMLElement | undefined>();

  const flightMovementsMap = useMemo(() => {
    const flightMovementsMap = mergeFlightMovements(data, []);

    return flightMovementsMap;
  }, []);

  const resources = useMemo<MbscResource[]>(() => {
    const resources: MbscResource[] = [
      {
        id: "root-unallocated",
        name: "Unallocated",
        eventCreation: false,
        background: "#000000",
        fixed: true,
        skipGradient: true,
        children: [
          {
            id: "unallocated",
            name: "",
            eventOverlap: true,
            color: "#FDB74E",
            background: "#00314D",
            cssClass: "mbsc-event-unassigned",
          },
        ],
      },
    ];

    if (!gates) return resources;

    // extract gates and group by terminals
    const terminalMap: { [key: string]: MbscResource } = {};
    for (const gate of gates) {
      const terminalId = gate.terminal.terminal_id || "";
      if (!terminalMap[terminalId]) {
        terminalMap[terminalId] = {
          id: terminalId,
          name:
            gate.terminal.alias || gate.terminal.terminal_name || terminalId,
          eventCreation: false,
          background: "#000000",
          children: [],
        };
      }
      const childrens = terminalMap[terminalId].children ?? [];
      terminalMap[terminalId].children = [
        ...childrens,
        {
          id: gate.gate_id,
          name: gate.alias || gate.gate_name || gate.gate_id,
          eventOverlap: true,
          color: "#027700",
          background: childrens.length % 2 === 1 ? "#131313" : "#1e1e1e",
        },
      ];
    }

    for (const resource of Object.values(terminalMap)) {
      resources.push(resource);
    }

    return resources;
  }, []);

  const gateAllocations = useMemo(() => {
    const allocations: (GateAllocation & {
      title: string;
      flight_leg_id: string;
    })[] = [];
    //
    for (const [, flightMovement] of flightMovementsMap) {
      let title = `${flightMovement.airline.airline_iata ?? ""}${
        flightMovement.flight_no
      }`;
      if (typeof flightMovement.ac_reg_no === "string") {
        title += ` (${flightMovement.ac_reg_no})`;
      }
      if (typeof flightMovement.actype_icao === "string") {
        title += ` [${flightMovement.actype_icao}]`;
      }
      for (const gate of flightMovement.gate_allocations || []) {
        allocations.push({
          ...gate,
          title,
          flight_leg_id: flightMovement.flight_leg_id,
        });
      }
    }
    return allocations;
  }, [flightMovementsMap]);

  const flightEvents = useMemo(() => {
    const events: MbscCalendarEvent[] = [];
    const now = time;

    // let unallocatedEventsCount = 0;

    for (const allocation of gateAllocations) {
      const gate_id = allocation.gate_id ?? "unallocated";

      let color: string | undefined = "#5521B5";
      if (allocation.allocation_end < now) {
        color = "#5B5B5B"; // past
      }
      if (allocation.allocation_start > now) {
        color = "#005686"; // future
      }
      if (gate_id === "unallocated") {
        color = undefined;
        // unallocatedEventsCount++;
      }

      events.push({
        start: new Date(allocation.allocation_start),
        end: new Date(allocation.allocation_end),
        title: allocation.title,
        resource: gate_id,
        timezone: "utc",
        color,

        // metadata
        id: allocation.id,
        flight_leg_id: allocation.flight_leg_id,

        // buffer
        // bufferBefore: 2,
        // bufferAfter: 5,
      });
    }

    return events;
  }, [gateAllocations, time]);

  const titleEvents = useMemo<MbscCalendarEvent[]>(() => {
    const events: MbscCalendarEvent[] = [];

    // Add movement density to resource headers
    for (const resource of resources) {
      if (!resource.children) continue;
      const resources = resource.children?.map((child) => child.id);

      const matchingAllocations = gateAllocations.filter((allocation) => {
        const gate_id = allocation.gate_id ?? "unallocated";
        return resources.includes(gate_id);
      });

      // add new event for every x minutes
      const timeStep = getTimeStepForZoom(zoomLevel);
      const from = new Date(startTime - 24 * 60 * 60 * 1000);
      from.setMinutes(from.getMinutes() - (from.getMinutes() % timeStep), 0, 0);
      const to = new Date(endTime + 24 * 60 * 60 * 1000);

      while (from < to) {
        const start = from.getTime();
        const end = from.getTime() + timeStep * 60 * 1000 - 1000;

        const count = matchingAllocations.filter(
          ({ allocation_start, allocation_end }) => {
            if (allocation_start < end && allocation_end > start) {
              return true;
            }
            return false;
          }
        ).length;

        // hue should be in range 0-120
        // if count = 0, hue = 120
        // if count = resources.length, hue = 0
        // Dynamically calculate the hue based on the count and total resources
        const hue =
          120 - (Math.min(count, resources.length) / resources.length) * 120;
        let color = `hsla(${hue}, 100%, 25%, 75%)`;

        if (resource.skipGradient) {
          color = "hsla(120, 100%, 25%, 75%)";
        }

        events.push({
          resource: resource.id,
          start: new Date(start),
          end: new Date(end),
          flight_leg_id: null,
          color: color,
          title: `${count}`,
          editable: false,
          movable: false,
          resize: false,
          actionableEvents: false,
          cssClass: "mbsc-event-fixed",
        });

        from.setMinutes(from.getMinutes() + timeStep);
      }
    }

    return events;
  }, [resources, gateAllocations, zoomLevel, startTime, endTime]);

  const blockedGateEvents = useMemo<MbscCalendarEvent[]>(() => {
    const events: MbscCalendarEvent[] = [];

    if (!gates) return events;

    for (const gate of gates) {
      const downtimes = gate.downtimes || [];
      for (const downtime of downtimes) {
        events.push({
          start: new Date(downtime.start_time),
          end: new Date(downtime.end_time),
          resource: gate.gate_id,
          title: downtime.maintenance_type || "Blocked",
          color: "black",
          timezone: "utc",
          flight_leg_id: null,
          editable: false,
          movable: false,
          resize: false,
          cssClass: "mbsc-event-fixed mbsc-event-blocked capitalize",
        });
      }
    }

    return events;
  }, []);

  const events = useMemo<MbscCalendarEvent[]>(() => {
    const events = [...flightEvents, ...titleEvents, ...blockedGateEvents];
    console.log("Events Updated");
    return events;
  }, [flightEvents, titleEvents, blockedGateEvents]);

  const view = useMemo<MbscEventcalendarView>(() => {
    const timeCellStep = getTimeStepForZoom(zoomLevel);

    return {
      timeline: {
        type: "week",
        timeCellStep,
        resolutionHorizontal: "hour",
        currentTimeIndicator: true,
        // rowHeight: "equal",
        // eventHeight: "equal",
      },
    };
  }, [zoomLevel]);

  const selectedDate = useMemo<MbscDateType>(() => {
    if (isToday(startTime)) {
      // Offset by 3 hours to show the current time in center of the screen
      const now = new Date();
      return sub(now, { hours: 2 });
    } else {
      return new Date(startTime);
    }
  }, [startTime]);

  const renderCustomEvent = useCallback((event: MbscCalendarEventData) => {
    return (
      <>
        <div
          className={twJoin(
            "mbsc-schedule-event-background mbsc-timeline-event-background mbsc-ios-dark mbsc-ios",
            event.currentResource?.isParent &&
              "mbsc-schedule-event-background-has-parent"
          )}
        ></div>
        <div
          aria-hidden="true"
          className={twJoin(
            "mbsc-schedule-event-inner mbsc-ios-dark mbsc-ios",
            event.currentResource?.isParent &&
              "mbsc-schedule-event-inner-has-parent"
          )}
        >
          <div className="mbsc-schedule-event-title mbsc-ios-dark mbsc-ios">
            {event.title}
          </div>
        </div>
      </>
    );
  }, []);

  const handleEventUpdate = useCallback(
    (args: MbscEventUpdateEvent) => {
      const event: MbscCalendarEvent = args.event;
      if (!event.flight_leg_id) {
        return;
      }

      const flightMovement = flightMovementsMap.get(event.flight_leg_id);
      const gate_allocation_id = event.id;
      const resource = event.resource;

      // TODO: Handle errors properly
      if (!resource || typeof resource !== "string") {
        alert("Resource not found. Please refresh the page.");
        return;
      }

      if (!flightMovement) {
        alert("Flight movement not found. Please refresh the page.");
        return;
      }

      if (flightMovement.flight_nature === "arrival") {
        alert("Something went wrong. Please contact support.");
        return;
      }

      const gateAllocation = flightMovement.gate_allocations.find(
        (allocation) => allocation.id === gate_allocation_id
      );

      if (!gateAllocation) {
        alert("Gate allocation not found. Please refresh the page.");
        return;
      }

      console.log("updated");
    },
    [flightMovementsMap]
  );

  /* Tooltip event handlers */
  const openTooltip = useCallback(
    (args: MbscEventClickEvent) => {
      const event: MbscCalendarEvent = args.event;
      if (!event.flight_leg_id) {
        return;
      }

      if (!flightMovementsMap.has(event.flight_leg_id)) {
        return;
      }

      setTooltipFlightLegId(event.flight_leg_id);
      setTooltipAnchor(args.domEvent.target.closest(".mbsc-schedule-event"));
    },
    [flightMovementsMap]
  );

  const handleEventClick = useCallback(
    (args: MbscEventClickEvent) => {
      // wait for 200ms to confirm if it is double click
      if (!timer.current) {
        timer.current = setTimeout(() => {
          timer.current = undefined;
          openTooltip(args);
        }, 200);
      }
    },
    [openTooltip]
  );

  const handleEventDoubleClick = useCallback(
    (args: MbscEventClickEvent) => {
      // Clear the timer if it exists to prevent tooltip from opening
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = undefined;
      }

      const event: MbscCalendarEvent = args.event;
      if (!event.flight_leg_id) {
        return;
      }

      if (!flightMovementsMap.has(event.flight_leg_id)) {
        return;
      }

      // Close the tooltip
      setTooltipFlightLegId(null);
      setTooltipAnchor(undefined);

      // Open the edit sheet
      // setSelectedFlightLegId(event.flight_leg_id);
    },
    [flightMovementsMap]
  );

  const handleTooltipClose = useCallback(() => {
    setTooltipFlightLegId(null);
    setTooltipAnchor(undefined);
  }, []);

  const handleEventDragStart = useCallback(() => {
    // Clear the timer if it exists to prevent tooltip from opening
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = undefined;
    }
  }, []);

  return (
    <div className="flex h-screen flex-col dark">
      <Eventcalendar
        selectedDate={selectedDate}
        view={view}
        data={events}
        resources={resources}
        dragToMove={true}
        dragInTime={false}
        dragToResize={false}
        dragToCreate={false}
        clickToCreate={false}
        showControls={false}
        dragBetweenResources={true}
        timezonePlugin={momentTimezone}
        dataTimezone="utc"
        displayTimezone={displayTimezone}
        renderScheduleEvent={renderCustomEvent}
        dragTimeStep={1}
        eventDelete={false}
        onEventUpdated={handleEventUpdate}
        // Tooltip options and events
        showEventTooltip={false}
        onEventClick={handleEventClick}
        onEventDoubleClick={handleEventDoubleClick}
        onEventDragStart={handleEventDragStart}
      />

      {/* Footer */}
      <div className="flex h-8 items-center justify-between px-6 text-xs">
        <div>{/* */}</div>
        <div className="flex items-center gap-3">
          <div>
            <select
              value={zoomLevel}
              onChange={(e) => setZoomLevel(e.target.value as ZoomLevel)}
            >
              <option value="50">50%</option>
              <option value="100">100%</option>
              <option value="125">125%</option>
              <option value="150">150%</option>
            </select>
          </div>
        </div>
      </div>

      {tooltipFlightLegId && (
        <Popup
          anchor={tooltipAnchor}
          focusElm={tooltipAnchor}
          contentPadding={false}
          display="anchored"
          isOpen={true}
          scrollLock={false}
          showOverlay={true}
          touchUi={false}
          maxWidth={300}
          onClose={handleTooltipClose}
          showArrow={false}
        >
          {tooltipFlightLegId}
        </Popup>
      )}
    </div>
  );
}

export function mergeFlightMovements(
  flightMovements: FlightMovement[] | undefined,
  modifiedMovements: FlightMovement[]
) {
  const flightMovementsMap = new Map<string, FlightMovement>();
  if (!flightMovements) return flightMovementsMap;

  for (let i = 0; i < flightMovements.length; i++) {
    flightMovementsMap.set(
      flightMovements[i].flight_leg_id,
      flightMovements[i]
    );
  }

  for (let i = 0; i < modifiedMovements.length; i++) {
    flightMovementsMap.set(
      modifiedMovements[i].flight_leg_id,
      modifiedMovements[i]
    );
  }

  return flightMovementsMap;
}
