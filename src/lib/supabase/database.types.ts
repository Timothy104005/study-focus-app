export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      class_groups: {
        Row: {
          created_at: string;
          description: string | null;
          id: string;
          invite_code: string;
          name: string;
          owner_user_id: string;
          slug: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          id?: string;
          invite_code?: string;
          name: string;
          owner_user_id: string;
          slug: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          id?: string;
          invite_code?: string;
          name?: string;
          owner_user_id?: string;
          slug?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "class_groups_owner_user_id_fkey";
            columns: ["owner_user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      discussion_posts: {
        Row: {
          author_user_id: string;
          content: string;
          created_at: string;
          group_id: string;
          id: string;
          updated_at: string;
        };
        Insert: {
          author_user_id: string;
          content: string;
          created_at?: string;
          group_id: string;
          id?: string;
          updated_at?: string;
        };
        Update: {
          author_user_id?: string;
          content?: string;
          created_at?: string;
          group_id?: string;
          id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "discussion_posts_author_user_id_fkey";
            columns: ["author_user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "discussion_posts_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      exam_countdowns: {
        Row: {
          created_at: string;
          exam_at: string;
          group_id: string | null;
          id: string;
          notes: string | null;
          subject: string | null;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          exam_at: string;
          group_id?: string | null;
          id?: string;
          notes?: string | null;
          subject?: string | null;
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          exam_at?: string;
          group_id?: string | null;
          id?: string;
          notes?: string | null;
          subject?: string | null;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "exam_countdowns_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "exam_countdowns_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      group_members: {
        Row: {
          group_id: string;
          id: string;
          joined_at: string;
          role: Database["public"]["Enums"]["group_member_role"];
          user_id: string;
        };
        Insert: {
          group_id: string;
          id?: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["group_member_role"];
          user_id: string;
        };
        Update: {
          group_id?: string;
          id?: string;
          joined_at?: string;
          role?: Database["public"]["Enums"]["group_member_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "group_members_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          display_name: string;
          email: string;
          id: string;
          last_seen_at: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          display_name: string;
          email: string;
          id: string;
          last_seen_at?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          display_name?: string;
          email?: string;
          id?: string;
          last_seen_at?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      study_sessions: {
        Row: {
          accumulated_focus_seconds: number;
          created_at: string;
          effective_duration_seconds: number | null;
          ended_at: string | null;
          group_id: string;
          id: string;
          integrity_status: Database["public"]["Enums"]["session_integrity_status"];
          interruption_count: number;
          last_interruption_at: string | null;
          last_interruption_reason: Database["public"]["Enums"]["interruption_reason"] | null;
          last_paused_at: string | null;
          last_resumed_at: string | null;
          notes: string | null;
          started_at: string;
          status: Database["public"]["Enums"]["study_session_status"];
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          accumulated_focus_seconds?: number;
          created_at?: string;
          effective_duration_seconds?: number | null;
          ended_at?: string | null;
          group_id: string;
          id?: string;
          integrity_status?: Database["public"]["Enums"]["session_integrity_status"];
          interruption_count?: number;
          last_interruption_at?: string | null;
          last_interruption_reason?: Database["public"]["Enums"]["interruption_reason"] | null;
          last_paused_at?: string | null;
          last_resumed_at?: string | null;
          notes?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["study_session_status"];
          title: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          accumulated_focus_seconds?: number;
          created_at?: string;
          effective_duration_seconds?: number | null;
          ended_at?: string | null;
          group_id?: string;
          id?: string;
          integrity_status?: Database["public"]["Enums"]["session_integrity_status"];
          interruption_count?: number;
          last_interruption_at?: string | null;
          last_interruption_reason?: Database["public"]["Enums"]["interruption_reason"] | null;
          last_paused_at?: string | null;
          last_resumed_at?: string | null;
          notes?: string | null;
          started_at?: string;
          status?: Database["public"]["Enums"]["study_session_status"];
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "study_sessions_group_id_fkey";
            columns: ["group_id"];
            referencedRelation: "class_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "study_sessions_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      create_class_group: {
        Args: {
          p_description?: string | null;
          p_name: string;
        };
        Returns: Database["public"]["Tables"]["class_groups"]["Row"];
      };
      create_study_session: {
        Args: {
          p_group_id: string;
          p_notes?: string | null;
          p_title: string;
        };
        Returns: Database["public"]["Tables"]["study_sessions"]["Row"];
      };
      delete_discussion_post: {
        Args: {
          p_post_id: string;
        };
        Returns: string;
      };
      flag_study_session_for_review: {
        Args: {
          p_session_id: string;
        };
        Returns: Database["public"]["Tables"]["study_sessions"]["Row"];
      };
      get_group_currently_studying_count: {
        Args: {
          p_group_id: string;
        };
        Returns: number;
      };
      get_group_leaderboard: {
        Args: {
          p_group_id: string;
          p_range?: string;
          p_timezone?: string;
        };
        Returns: {
          avatar_url: string | null;
          display_name: string;
          group_id: string;
          integrity_status: Database["public"]["Enums"]["session_integrity_status"];
          interruption_count: number;
          range_type: string;
          rank: number;
          sessions_completed: number;
          total_seconds: number;
          user_id: string;
          window_end: string;
          window_start: string;
        }[];
      };
      get_group_presence_snapshot: {
        Args: {
          p_group_id: string;
        };
        Returns: {
          active_session_id: string | null;
          avatar_url: string | null;
          display_name: string;
          last_seen_at: string | null;
          status: string;
          user_id: string;
        }[];
      };
      hide_discussion_post: {
        Args: {
          p_post_id: string;
          p_reason?: string | null;
        };
        Returns: Database["public"]["Tables"]["discussion_posts"]["Row"];
      };
      join_group_by_invite: {
        Args: {
          p_invite_code: string;
        };
        Returns: Database["public"]["Tables"]["group_members"]["Row"];
      };
      pause_study_session: {
        Args: {
          p_session_id: string;
        };
        Returns: Database["public"]["Tables"]["study_sessions"]["Row"];
      };
      report_study_session_interruption: {
        Args: {
          p_reason: Database["public"]["Enums"]["interruption_reason"];
          p_session_id: string;
        };
        Returns: Database["public"]["Tables"]["study_sessions"]["Row"];
      };
      resume_study_session: {
        Args: {
          p_session_id: string;
        };
        Returns: Database["public"]["Tables"]["study_sessions"]["Row"];
      };
      stop_study_session: {
        Args: {
          p_session_id: string;
        };
        Returns: Database["public"]["Tables"]["study_sessions"]["Row"];
      };
      touch_profile_presence: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
    };
    Enums: {
      group_member_role: "owner" | "admin" | "member";
      interruption_reason: "tab_hidden" | "window_blur" | "manual";
      session_integrity_status: "clean" | "warning" | "flagged";
      study_session_status: "active" | "paused" | "stopped";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
