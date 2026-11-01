import { ActionQueue } from "@/components/ActionQueue";
import { TaskManager } from "@/components/TaskManager";
export default function Page() {
  return (
    <>
      <ActionQueue all />
      <TaskManager />
    </>
  );
}
