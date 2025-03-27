import CenteredPageWrapper from "@/components/clientSide/Tags/Layout/CenteredPageWrapper";
import TagSubNavbar from "@/components/clientSide/Tags/Layout/TagSubNavbar";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  params: Promise<{ name: string }>;
};

export default async function Layout({ children, params }: Props) {
  const { name } = await params;

  return (
    <CenteredPageWrapper>
      <TagSubNavbar tag={name} />
      {children}
    </CenteredPageWrapper>
  );
}