CREATE TABLE "check_runs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "check_runs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"owner" varchar NOT NULL,
	"repo" varchar NOT NULL,
	"checkRunId" bigint NOT NULL,
	"headSHA" varchar NOT NULL,
	"status" varchar NOT NULL,
	"conclusion" varchar,
	"dateCreated" varchar NOT NULL
);
