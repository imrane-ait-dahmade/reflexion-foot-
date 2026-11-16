import { describe, expect, it } from "vitest";
import {
  formatPositions,
  playerFullName,
  playerInitials,
} from "@/components/coach/players/player-utils";
import type { PlayerResponse } from "@/lib/api/types";

const basePlayer: PlayerResponse = {
  id: "p1",
  first_name: "Ada",
  last_name: "Lovelace",
  date_of_birth: null,
  nationality: null,
  gender: null,
  email: null,
  phone: null,
  primary_position_id: "pos-cm",
  primary_position: {
    id: "pos-cm",
    code: "CM",
    name: "Central Midfielder",
    display_order: 1,
    is_active: true,
  },
  secondary_position_ids: ["pos-cam"],
  secondary_positions: [
    {
      id: "pos-cam",
      code: "CAM",
      name: "Attacking Midfielder",
      display_order: 2,
      is_active: true,
    },
  ],
  preferred_foot: null,
  height_cm: null,
  weight_kg: null,
  jersey_number: 10,
  is_active: true,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  archived_at: null,
};

describe("player-utils", () => {
  it("formats full name and initials", () => {
    expect(playerFullName(basePlayer)).toBe("Ada Lovelace");
    expect(playerInitials(basePlayer)).toBe("AL");
  });

  it("formats primary and secondary positions", () => {
    expect(formatPositions(basePlayer)).toBe("CM · CAM");
  });
});
