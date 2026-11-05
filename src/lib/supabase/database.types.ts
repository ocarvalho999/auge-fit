// Arquivo gerado por scripts/gen-db-types.ts. Não edite à mão.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string | null;
          metadata?: Json;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      black_slot_reservations: {
        Row: {
          id: string;
          professional_id: string;
          student_id: string;
          subscription_id: string | null;
          expires_at: string;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          professional_id: string;
          student_id: string;
          subscription_id?: string | null;
          expires_at: string;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          professional_id?: string;
          student_id?: string;
          subscription_id?: string | null;
          expires_at?: string;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "black_slot_reservations_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },
          { foreignKeyName: "black_slot_reservations_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "black_slot_reservations_subscription_id_fkey"; columns: ["subscription_id"]; isOneToOne: false; referencedRelation: "subscriptions"; referencedColumns: ["id"] },
        ];
      };
      body_measurements: {
        Row: {
          id: string;
          profile_id: string;
          measured_on: string;
          weight_kg: number | null;
          waist_cm: number | null;
          chest_cm: number | null;
          hip_cm: number | null;
          arm_cm: number | null;
          thigh_cm: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          measured_on: string;
          weight_kg?: number | null;
          waist_cm?: number | null;
          chest_cm?: number | null;
          hip_cm?: number | null;
          arm_cm?: number | null;
          thigh_cm?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          measured_on?: string;
          weight_kg?: number | null;
          waist_cm?: number | null;
          chest_cm?: number | null;
          hip_cm?: number | null;
          arm_cm?: number | null;
          thigh_cm?: number | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "body_measurements_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      checkins: {
        Row: {
          id: string;
          professional_student_id: string;
          due_on: string;
          submitted_at: string | null;
          answers: Json | null;
          status: string;
        };
        Insert: {
          id?: string;
          professional_student_id: string;
          due_on: string;
          submitted_at?: string | null;
          answers?: Json | null;
          status?: string;
        };
        Update: {
          id?: string;
          professional_student_id?: string;
          due_on?: string;
          submitted_at?: string | null;
          answers?: Json | null;
          status?: string;
        };
        Relationships: [
          { foreignKeyName: "checkins_professional_student_id_fkey"; columns: ["professional_student_id"]; isOneToOne: false; referencedRelation: "professional_students"; referencedColumns: ["id"] },
        ];
      };
      consents: {
        Row: {
          id: string;
          profile_id: string;
          type: string;
          document_version: string;
          granted_at: string;
          revoked_at: string | null;
        };
        Insert: {
          id?: string;
          profile_id: string;
          type: string;
          document_version: string;
          granted_at?: string;
          revoked_at?: string | null;
        };
        Update: {
          id?: string;
          profile_id?: string;
          type?: string;
          document_version?: string;
          granted_at?: string;
          revoked_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "consents_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      coupon_redemptions: {
        Row: {
          id: string;
          coupon_id: string;
          profile_id: string | null;
          payment_id: string | null;
          redeemed_at: string;
        };
        Insert: {
          id?: string;
          coupon_id: string;
          profile_id?: string | null;
          payment_id?: string | null;
          redeemed_at?: string;
        };
        Update: {
          id?: string;
          coupon_id?: string;
          profile_id?: string | null;
          payment_id?: string | null;
          redeemed_at?: string;
        };
        Relationships: [
          { foreignKeyName: "coupon_redemptions_coupon_id_fkey"; columns: ["coupon_id"]; isOneToOne: false; referencedRelation: "coupons"; referencedColumns: ["id"] },
          { foreignKeyName: "coupon_redemptions_payment_id_fkey"; columns: ["payment_id"]; isOneToOne: false; referencedRelation: "payments"; referencedColumns: ["id"] },
          { foreignKeyName: "coupon_redemptions_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      coupons: {
        Row: {
          id: string;
          code: string;
          discount_percent: number;
          campaign: string | null;
          expires_at: string | null;
          max_uses: number | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          discount_percent: number;
          campaign?: string | null;
          expires_at?: string | null;
          max_uses?: number | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          discount_percent?: number;
          campaign?: string | null;
          expires_at?: string | null;
          max_uses?: number | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          muscle_group: string;
          instructions: string | null;
          media_path: string | null;
          reviewed_by: string | null;
          published: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          muscle_group: string;
          instructions?: string | null;
          media_path?: string | null;
          reviewed_by?: string | null;
          published?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          muscle_group?: string;
          instructions?: string | null;
          media_path?: string | null;
          reviewed_by?: string | null;
          published?: boolean;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "exercises_reviewed_by_fkey"; columns: ["reviewed_by"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },
        ];
      };
      feedbacks: {
        Row: {
          id: string;
          checkin_id: string;
          body: string;
          author_professional_id: string;
          published_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          checkin_id: string;
          body: string;
          author_professional_id: string;
          published_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          checkin_id?: string;
          body?: string;
          author_professional_id?: string;
          published_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "feedbacks_author_professional_id_fkey"; columns: ["author_professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },
          { foreignKeyName: "feedbacks_checkin_id_fkey"; columns: ["checkin_id"]; isOneToOne: false; referencedRelation: "checkins"; referencedColumns: ["id"] },
        ];
      };
      notifications: {
        Row: {
          id: string;
          profile_id: string | null;
          template: string;
          status: string;
          dedupe_key: string | null;
          sent_at: string | null;
          provider_message_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          template: string;
          status?: string;
          dedupe_key?: string | null;
          sent_at?: string | null;
          provider_message_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          template?: string;
          status?: string;
          dedupe_key?: string | null;
          sent_at?: string | null;
          provider_message_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "notifications_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      nutrition_access: {
        Row: {
          id: string;
          profile_id: string | null;
          whatsapp: string | null;
          granted_at: string | null;
          granted_by: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          whatsapp?: string | null;
          granted_at?: string | null;
          granted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          whatsapp?: string | null;
          granted_at?: string | null;
          granted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "nutrition_access_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      payments: {
        Row: {
          id: string;
          subscription_id: string;
          status: string;
          amount_cents: number;
          method: string | null;
          provider_payment_id: string;
          paid_at: string | null;
          refund_requested_at: string | null;
          refunded_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          subscription_id: string;
          status: string;
          amount_cents: number;
          method?: string | null;
          provider_payment_id: string;
          paid_at?: string | null;
          refund_requested_at?: string | null;
          refunded_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          subscription_id?: string;
          status?: string;
          amount_cents?: number;
          method?: string | null;
          provider_payment_id?: string;
          paid_at?: string | null;
          refund_requested_at?: string | null;
          refunded_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "payments_subscription_id_fkey"; columns: ["subscription_id"]; isOneToOne: false; referencedRelation: "subscriptions"; referencedColumns: ["id"] },
        ];
      };
      plan_prices: {
        Row: {
          id: string;
          plan_id: string;
          interval: string;
          amount_cents: number;
          provider_ref: string | null;
          active: boolean;
        };
        Insert: {
          id?: string;
          plan_id: string;
          interval: string;
          amount_cents: number;
          provider_ref?: string | null;
          active?: boolean;
        };
        Update: {
          id?: string;
          plan_id?: string;
          interval?: string;
          amount_cents?: number;
          provider_ref?: string | null;
          active?: boolean;
        };
        Relationships: [
          { foreignKeyName: "plan_prices_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "plans"; referencedColumns: ["id"] },
        ];
      };
      plans: {
        Row: {
          id: string;
          code: string;
          name: string;
          features: Json;
          active: boolean;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          features?: Json;
          active?: boolean;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          features?: Json;
          active?: boolean;
        };
        Relationships: [

        ];
      };
      professional_students: {
        Row: {
          id: string;
          professional_id: string;
          student_id: string;
          subscription_id: string | null;
          status: string;
          starts_at: string;
          ends_at: string | null;
          photos_allowed: boolean;
        };
        Insert: {
          id?: string;
          professional_id: string;
          student_id: string;
          subscription_id?: string | null;
          status?: string;
          starts_at?: string;
          ends_at?: string | null;
          photos_allowed?: boolean;
        };
        Update: {
          id?: string;
          professional_id?: string;
          student_id?: string;
          subscription_id?: string | null;
          status?: string;
          starts_at?: string;
          ends_at?: string | null;
          photos_allowed?: boolean;
        };
        Relationships: [
          { foreignKeyName: "professional_students_professional_id_fkey"; columns: ["professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },
          { foreignKeyName: "professional_students_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "professional_students_subscription_id_fkey"; columns: ["subscription_id"]; isOneToOne: false; referencedRelation: "subscriptions"; referencedColumns: ["id"] },
        ];
      };
      professionals: {
        Row: {
          id: string;
          profile_id: string;
          cref_number: string;
          cref_uf: string;
          cref_verified_at: string | null;
          verified_by: string | null;
          capacity: number;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          cref_number: string;
          cref_uf: string;
          cref_verified_at?: string | null;
          verified_by?: string | null;
          capacity?: number;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          cref_number?: string;
          cref_uf?: string;
          cref_verified_at?: string | null;
          verified_by?: string | null;
          capacity?: number;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "professionals_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "professionals_verified_by_fkey"; columns: ["verified_by"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      profiles: {
        Row: {
          id: string;
          role: string;
          full_name: string;
          birth_date: string | null;
          status: string;
          marketing_emails: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: string;
          full_name?: string;
          birth_date?: string | null;
          status?: string;
          marketing_emails?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: string;
          full_name?: string;
          birth_date?: string | null;
          status?: string;
          marketing_emails?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [

        ];
      };
      progress_photos: {
        Row: {
          id: string;
          profile_id: string;
          storage_path: string;
          pose: string;
          taken_on: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          storage_path: string;
          pose: string;
          taken_on: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          storage_path?: string;
          pose?: string;
          taken_on?: string;
          created_at?: string;
        };
        Relationships: [
          { foreignKeyName: "progress_photos_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      rate_limits: {
        Row: {
          key: string;
          window_start: string;
          hits: number;
        };
        Insert: {
          key: string;
          window_start: string;
          hits?: number;
        };
        Update: {
          key?: string;
          window_start?: string;
          hits?: number;
        };
        Relationships: [

        ];
      };
      set_logs: {
        Row: {
          id: string;
          workout_log_id: string;
          exercise_id: string;
          set_number: number;
          weight_kg: number;
          reps: number;
          client_uuid: string;
          logged_at: string;
        };
        Insert: {
          id?: string;
          workout_log_id: string;
          exercise_id: string;
          set_number: number;
          weight_kg: number;
          reps: number;
          client_uuid: string;
          logged_at?: string;
        };
        Update: {
          id?: string;
          workout_log_id?: string;
          exercise_id?: string;
          set_number?: number;
          weight_kg?: number;
          reps?: number;
          client_uuid?: string;
          logged_at?: string;
        };
        Relationships: [
          { foreignKeyName: "set_logs_exercise_id_fkey"; columns: ["exercise_id"]; isOneToOne: false; referencedRelation: "exercises"; referencedColumns: ["id"] },
          { foreignKeyName: "set_logs_workout_log_id_fkey"; columns: ["workout_log_id"]; isOneToOne: false; referencedRelation: "workout_logs"; referencedColumns: ["id"] },
        ];
      };
      staff_invites: {
        Row: {
          email: string;
          created_at: string;
        };
        Insert: {
          email: string;
          created_at?: string;
        };
        Update: {
          email?: string;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      student_profiles: {
        Row: {
          profile_id: string;
          goal: string | null;
          experience_level: string | null;
          onboarded_at: string | null;
        };
        Insert: {
          profile_id: string;
          goal?: string | null;
          experience_level?: string | null;
          onboarded_at?: string | null;
        };
        Update: {
          profile_id?: string;
          goal?: string | null;
          experience_level?: string | null;
          onboarded_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "student_profiles_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      subscriptions: {
        Row: {
          id: string;
          profile_id: string | null;
          plan_price_id: string;
          status: string;
          expected_amount_cents: number;
          coupon_id: string | null;
          current_period_end: string | null;
          grace_until: string | null;
          provider_id: string | null;
          cancelled_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id?: string | null;
          plan_price_id: string;
          status?: string;
          expected_amount_cents: number;
          coupon_id?: string | null;
          current_period_end?: string | null;
          grace_until?: string | null;
          provider_id?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string | null;
          plan_price_id?: string;
          status?: string;
          expected_amount_cents?: number;
          coupon_id?: string | null;
          current_period_end?: string | null;
          grace_until?: string | null;
          provider_id?: string | null;
          cancelled_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "subscriptions_coupon_id_fkey"; columns: ["coupon_id"]; isOneToOne: false; referencedRelation: "coupons"; referencedColumns: ["id"] },
          { foreignKeyName: "subscriptions_plan_price_id_fkey"; columns: ["plan_price_id"]; isOneToOne: false; referencedRelation: "plan_prices"; referencedColumns: ["id"] },
          { foreignKeyName: "subscriptions_profile_id_fkey"; columns: ["profile_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      waitlist_entries: {
        Row: {
          id: string;
          email: string;
          source: string;
          plan_code: string | null;
          consented_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          source: string;
          plan_code?: string | null;
          consented_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          source?: string;
          plan_code?: string | null;
          consented_at?: string;
          created_at?: string;
        };
        Relationships: [

        ];
      };
      webhook_events: {
        Row: {
          id: string;
          provider_event_key: string;
          topic: string | null;
          payload: Json;
          received_at: string;
          processed_at: string | null;
        };
        Insert: {
          id?: string;
          provider_event_key: string;
          topic?: string | null;
          payload: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Update: {
          id?: string;
          provider_event_key?: string;
          topic?: string | null;
          payload?: Json;
          received_at?: string;
          processed_at?: string | null;
        };
        Relationships: [

        ];
      };
      workout_exercises: {
        Row: {
          id: string;
          workout_id: string;
          exercise_id: string;
          position: number;
          sets: number;
          reps_target: string | null;
          rest_seconds: number | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          workout_id: string;
          exercise_id: string;
          position?: number;
          sets?: number;
          reps_target?: string | null;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          workout_id?: string;
          exercise_id?: string;
          position?: number;
          sets?: number;
          reps_target?: string | null;
          rest_seconds?: number | null;
          notes?: string | null;
        };
        Relationships: [
          { foreignKeyName: "workout_exercises_exercise_id_fkey"; columns: ["exercise_id"]; isOneToOne: false; referencedRelation: "exercises"; referencedColumns: ["id"] },
          { foreignKeyName: "workout_exercises_workout_id_fkey"; columns: ["workout_id"]; isOneToOne: false; referencedRelation: "workouts"; referencedColumns: ["id"] },
        ];
      };
      workout_logs: {
        Row: {
          id: string;
          student_id: string;
          workout_id: string | null;
          workout_name: string | null;
          started_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          student_id: string;
          workout_id?: string | null;
          workout_name?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          student_id?: string;
          workout_id?: string | null;
          workout_name?: string | null;
          started_at?: string;
          finished_at?: string | null;
        };
        Relationships: [
          { foreignKeyName: "workout_logs_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
          { foreignKeyName: "workout_logs_workout_id_fkey"; columns: ["workout_id"]; isOneToOne: false; referencedRelation: "workouts"; referencedColumns: ["id"] },
        ];
      };
      workout_plans: {
        Row: {
          id: string;
          kind: string;
          name: string;
          student_id: string | null;
          author_professional_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          kind: string;
          name: string;
          student_id?: string | null;
          author_professional_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          kind?: string;
          name?: string;
          student_id?: string | null;
          author_professional_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          { foreignKeyName: "workout_plans_author_professional_id_fkey"; columns: ["author_professional_id"]; isOneToOne: false; referencedRelation: "professionals"; referencedColumns: ["id"] },
          { foreignKeyName: "workout_plans_student_id_fkey"; columns: ["student_id"]; isOneToOne: false; referencedRelation: "profiles"; referencedColumns: ["id"] },
        ];
      };
      workouts: {
        Row: {
          id: string;
          plan_id: string;
          name: string;
          position: number;
        };
        Insert: {
          id?: string;
          plan_id: string;
          name: string;
          position?: number;
        };
        Update: {
          id?: string;
          plan_id?: string;
          name?: string;
          position?: number;
        };
        Relationships: [
          { foreignKeyName: "workouts_plan_id_fkey"; columns: ["plan_id"]; isOneToOne: false; referencedRelation: "workout_plans"; referencedColumns: ["id"] },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      admin_checkin_status: { Args: Record<PropertyKey, never>; Returns: { id: string; professional_student_id: string; due_on: string; submitted_at: string; status: string }[] };
      black_slots_used: { Args: { p_professional_id: string }; Returns: number };
      can_read_plan: { Args: { p_plan_id: string }; Returns: boolean };
      can_read_plan_row: { Args: { p_kind: string; p_student_id: string; p_author: string; p_status: string }; Returns: boolean };
      can_read_workout: { Args: { p_workout_id: string }; Returns: boolean };
      can_write_plan: { Args: { p_plan_id: string }; Returns: boolean };
      can_write_plan_row: { Args: { p_kind: string; p_student_id: string; p_author: string }; Returns: boolean };
      can_write_workout: { Args: { p_workout_id: string }; Returns: boolean };
      checkin_is_mine_as_professional: { Args: { p_checkin_id: string }; Returns: boolean };
      checkin_student: { Args: { p_checkin_id: string }; Returns: string };
      current_professional_id: { Args: Record<PropertyKey, never>; Returns: string };
      has_consent: { Args: { p_user_id: string; p_type: string }; Returns: boolean };
      has_entitlement: { Args: { p_user_id: string; p_feature: string }; Returns: boolean };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_linked_professional: { Args: { p_student_id: string }; Returns: boolean };
      link_black_student: { Args: { p_subscription_id: string; p_professional_id: string; p_actor: string }; Returns: string };
      link_is_mine_and_active: { Args: { p_link_id: string }; Returns: boolean };
      link_student: { Args: { p_link_id: string }; Returns: string };
      log_student: { Args: { p_workout_log_id: string }; Returns: string };
      photo_path_owner: { Args: { p_name: string }; Returns: string };
      pro_is_sellable: { Args: Record<PropertyKey, never>; Returns: boolean };
      professional_can_view_photos: { Args: { p_student_id: string }; Returns: boolean };
      professional_public: { Args: { p_professional_id: string }; Returns: { full_name: string; cref_number: string; cref_uf: string }[] };
      propose_exercise_review: { Args: { p_exercise_id: string; p_instructions: string }; Returns: undefined };
      rate_limit_hit: { Args: { p_key: string; p_window_seconds: number }; Returns: number };
      redeem_coupon: { Args: { p_coupon_id: string; p_profile_id: string; p_payment_id: string }; Returns: boolean };
      reserve_black_slot: { Args: { p_student_id: string; p_minutes?: number }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
