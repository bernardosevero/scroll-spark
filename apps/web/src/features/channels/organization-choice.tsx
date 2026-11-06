import { Button } from "@scroll-spark/ui/button";
import { Card } from "@scroll-spark/ui/card";

export function OrganizationChoice({
  organizations,
  isSaving,
  hasFailed,
  onChoose,
}: {
  organizations: { id: string; name: string }[];
  isSaving: boolean;
  hasFailed: boolean;
  onChoose: (organizationId: string) => void;
}) {
  return (
    <Card className="flex flex-col items-start gap-4">
      <h2 className="font-display text-2xl font-extrabold">Which organization?</h2>
      <p>Your Buffer account has more than one. Choose the one you post from.</p>
      <div className="flex flex-wrap gap-3">
        {organizations.map(({ id, name }) => (
          <Button
            key={id}
            variant="plain"
            disabled={isSaving}
            onClick={() => {
              onChoose(id);
            }}
          >
            {name}
          </Button>
        ))}
      </div>
      {hasFailed && (
        <p role="alert" className="font-medium text-danger">
          That didn&apos;t save, so try again.
        </p>
      )}
    </Card>
  );
}
