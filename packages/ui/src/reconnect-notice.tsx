import { ButtonLink } from "./button";

export interface ReconnectNoticeProps {
  /** Where "Reconnect Buffer" goes: the start of the connect flow. */
  href: string;
}

/** The one place besides errors where `danger` appears: Buffer needs the user to connect again. */
export function ReconnectNotice({ href }: ReconnectNoticeProps) {
  return (
    <div role="alert" className="border-b-[3px] border-navy bg-danger text-paper">
      <div className="mx-auto flex max-w-[1160px] flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3">
        <p className="font-bold">Buffer needs you to connect again. Your captures are safe.</p>
        <ButtonLink href={href} variant="plain" className="text-navy">
          Reconnect Buffer
        </ButtonLink>
      </div>
    </div>
  );
}
