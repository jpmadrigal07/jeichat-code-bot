import { expect, test } from "bun:test";
import {
  isAssignedToBot,
  isUnassignedFromBot,
  ticketIdFromEvent,
} from "./assignee.js";

const event = {
  id: "evt-1",
  channelId: "ticket-1",
  parentId: "general-1",
  type: "assignee_changed",
  fromValue: null,
  toValue: { id: "bot-user", name: "Code" },
  ticket: { id: "ticket-1", name: "Settings export", displayId: "GEN-12" },
};

test("detects when the bot becomes the assignee", () => {
  expect(isAssignedToBot(event, "bot-user")).toBe(true);
  expect(isAssignedToBot(event, "someone-else")).toBe(false);
});

test("ignores other ticket events and unassign", () => {
  expect(
    isAssignedToBot({ ...event, type: "status_changed" }, "bot-user"),
  ).toBe(false);
  expect(isAssignedToBot({ ...event, toValue: null }, "bot-user")).toBe(false);
});

test("detects when the bot is no longer the assignee", () => {
  const unassign = {
    ...event,
    fromValue: { id: "bot-user", name: "Code" },
    toValue: null,
  };
  expect(isUnassignedFromBot(unassign, "bot-user")).toBe(true);
  expect(
    isUnassignedFromBot(
      {
        ...unassign,
        toValue: { id: "human", name: "Ada" },
      },
      "bot-user",
    ),
  ).toBe(true);
  expect(isUnassignedFromBot(event, "bot-user")).toBe(false);
});

test("reads the ticket id from the event", () => {
  expect(ticketIdFromEvent(event)).toBe("ticket-1");
  expect(ticketIdFromEvent({ ...event, ticket: null })).toBe("ticket-1");
});
