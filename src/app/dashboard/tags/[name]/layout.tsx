import CenteredPageWrapper from "@/components/clientSide/Tags/Layout/CenteredPageWrapper";
import TagSubNavbar from "@/components/clientSide/Tags/Layout/TagSubNavbar";


export default function TagLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { name: string };
}) {
  return (
    <CenteredPageWrapper>
      <TagSubNavbar tag={params.name} />
      {children}
    </CenteredPageWrapper>
  );
}
