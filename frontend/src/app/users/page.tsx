import { Metadata } from "next";
import UserList from "@/components/Users/UserList";

export const metadata: Metadata = {
  title: "Users",
  description: "Everyone on the board.",
};

export default function UsersPage() {
  return <UserList />;
}
