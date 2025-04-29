import CenteredPageWrapper from "@/components/clientSide/Tags/Layout/CenteredPageWrapper";
import { ReactNode } from "react";

type Props = {
  children: ReactNode;
  params: Promise<{ name: string }>;
};

export default async function Layout({ children }: Props) {

  return (
    <CenteredPageWrapper>
      {children}
    </CenteredPageWrapper>
  );
}