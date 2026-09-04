import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    tenant_id?: string;
    roles?: string[];
  }
  interface Session {
    user: User & DefaultSession["user"];
  }
}
