CREATE TABLE "analyses" (
	"capture_id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"summary" text NOT NULL,
	"topic" text NOT NULL,
	"angle" text NOT NULL,
	"trend_phrases" jsonb NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "trends_geo" text;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_capture_id_captures_id_fk" FOREIGN KEY ("capture_id") REFERENCES "public"."captures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_user_recent" ON "analyses" USING btree ("user_id","created_at");