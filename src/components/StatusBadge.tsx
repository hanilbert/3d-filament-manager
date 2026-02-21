import { Badge } from "@/components/ui/badge";

interface StatusBadgeProps {
  status: "ACTIVE" | "EMPTY";
}

export function StatusBadge({ status }: StatusBadgeProps) {
  if (status === "ACTIVE") {
    return (
      <Badge className="bg-green-100 text-green-800 hover:bg-green-100 border-green-200">
        使用中
      </Badge>
    );
  }
  return (
    <Badge className="bg-gray-100 text-gray-600 hover:bg-gray-100 border-gray-200">
      已归档
    </Badge>
  );
}
