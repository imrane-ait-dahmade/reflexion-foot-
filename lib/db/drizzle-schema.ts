import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["coach", "player"]);
export const sessionStatusEnum = pgEnum("session_status", [
  "draft",
  "active",
  "closed",
]);
export const testSlugEnum = pgEnum("test_slug", [
  "visual-tracking",
  "visual-memory",
  "reaction-time",
  "peripheral-vision",
  "football-visual-scanning",
  "sequential-visual-search",
  "digit-memory",
  "dual-target-tracking",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  displayName: text("display_name").notNull(),
  role: userRoleEnum("role").notNull().default("player"),
  /** Better Auth user id — set when a coach registers / signs in. */
  authUserId: text("auth_user_id").unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const trainingSessions = pgTable(
  "training_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    coachId: uuid("coach_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    status: sessionStatusEnum("status").notNull().default("draft"),
    randomizeExercises: boolean("randomize_exercises").notNull().default(true),
    exerciseCount: integer("exercise_count").notNull().default(2),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("training_sessions_code_uidx").on(table.code),
    check(
      "training_sessions_code_format",
      sql`${table.code} ~ '^[A-Z0-9]{4,8}$'`,
    ),
    check(
      "training_sessions_exercise_count",
      sql`${table.exerciseCount} >= 1 AND ${table.exerciseCount} <= 10`,
    ),
  ],
);

export const sessionExercises = pgTable(
  "session_exercises",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    testSlug: testSlugEnum("test_slug").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("session_exercises_unique_test").on(
      table.sessionId,
      table.testSlug,
    ),
    uniqueIndex("session_exercises_sort_unique").on(
      table.sessionId,
      table.sortOrder,
    ),
  ],
);

export const sessionPlayers = pgTable(
  "session_players",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    displayName: text("display_name").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("session_players_session_name_uidx").on(
      table.sessionId,
      sql`lower(${table.displayName})`,
    ),
    check(
      "session_players_name_not_blank",
      sql`length(trim(${table.displayName})) >= 2`,
    ),
  ],
);

export const testResults = pgTable(
  "test_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    sessionPlayerId: uuid("session_player_id")
      .notNull()
      .references(() => sessionPlayers.id, { onDelete: "cascade" }),
    testSlug: testSlugEnum("test_slug").notNull(),
    score: integer("score").notNull(),
    accuracy: numeric("accuracy", { precision: 5, scale: 1 }).notNull(),
    correctAnswers: integer("correct_answers").notNull().default(0),
    errors: integer("errors").notNull().default(0),
    averageReactionMs: integer("average_reaction_ms").notNull().default(0),
    bestReactionMs: integer("best_reaction_ms").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    metrics: jsonb("metrics").notNull().default({}),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("test_results_unique_attempt").on(
      table.sessionPlayerId,
      table.testSlug,
    ),
    check("test_results_score", sql`${table.score} >= 0 AND ${table.score} <= 100`),
    check(
      "test_results_accuracy",
      sql`${table.accuracy} >= 0 AND ${table.accuracy} <= 100`,
    ),
  ],
);

export const aiReportTypeEnum = pgEnum("ai_report_type", [
  "test",
  "session",
  "progress",
]);

export const aiReportStatusEnum = pgEnum("ai_report_status", [
  "pending",
  "processing",
  "completed",
  "failed",
  "not_eligible",
]);

export const aiReports = pgTable(
  "ai_reports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => trainingSessions.id, { onDelete: "cascade" }),
    sessionPlayerId: uuid("session_player_id")
      .notNull()
      .references(() => sessionPlayers.id, { onDelete: "cascade" }),
    testResultId: uuid("test_result_id").references(() => testResults.id, {
      onDelete: "cascade",
    }),
    reportType: aiReportTypeEnum("report_type").notNull(),
    status: aiReportStatusEnum("status").notNull().default("pending"),
    reportData: jsonb("report_data"),
    model: text("model"),
    promptVersion: text("prompt_version"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    errorCode: text("error_code"),
    generatedAt: timestamp("generated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("ai_reports_test_uidx")
      .on(table.sessionPlayerId, table.testResultId, table.reportType)
      .where(sql`${table.testResultId} IS NOT NULL`),
    uniqueIndex("ai_reports_player_session_uidx")
      .on(table.sessionPlayerId, table.sessionId, table.reportType)
      .where(sql`${table.reportType} IN ('session', 'progress')`),
  ],
);
