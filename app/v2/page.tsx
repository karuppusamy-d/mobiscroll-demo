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
import { useCallback, useMemo, useRef, useState } from "react";
import { isToday, sub } from "date-fns";
import moment from "moment-timezone";
import { twJoin } from "tailwind-merge";
import { FlightMovement, data, gates } from "../data";
import { events } from "../events";

// import "@mobiscroll/react/dist/css/mobiscroll.min.css";
import "../mobiscroll.css";

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
  // const [endTime] = useState(new Date("2025-12-18T23:59:59").getTime());
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>("125");

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
