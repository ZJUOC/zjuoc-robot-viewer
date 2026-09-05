import type { Metadata } from "next";
import { RobotViewer } from "./RobotViewer";

export const metadata: Metadata = {
  title: "水下机器人 · 三维姿态展示",
  description: "基于 Three.js 的水下机器人演示模型",
};

export default function RobotViewerPage() {
  return <RobotViewer />;
}
