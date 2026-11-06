CREATE TABLE "channel_clusters" (
	"user_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"cluster_id" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "channel_clusters_user_id_channel_id_cluster_id_pk" PRIMARY KEY("user_id","channel_id","cluster_id")
);
--> statement-breakpoint
CREATE TABLE "channel_posts" (
	"user_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"post_id" text NOT NULL,
	"text" text NOT NULL,
	"summary" text,
	"cluster_id" text,
	"posted_at" timestamp with time zone NOT NULL,
	"last_sent_at" timestamp with time zone,
	"scheduled_at" timestamp with time zone,
	CONSTRAINT "channel_posts_user_id_channel_id_post_id_pk" PRIMARY KEY("user_id","channel_id","post_id")
);
--> statement-breakpoint
CREATE TABLE "channel_profiles" (
	"user_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"profile_refreshed_at" timestamp with time zone NOT NULL,
	"read_posts" integer NOT NULL,
	CONSTRAINT "channel_profiles_user_id_channel_id_pk" PRIMARY KEY("user_id","channel_id")
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "channels" jsonb;--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "duplicates" jsonb;--> statement-breakpoint
ALTER TABLE "channel_clusters" ADD CONSTRAINT "channel_clusters_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_posts" ADD CONSTRAINT "channel_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_profiles" ADD CONSTRAINT "channel_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;