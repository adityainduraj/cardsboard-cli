import { NodeProps } from "@xyflow/react";
import { BaseNode } from "../shared/BaseNode";

export interface ImageNodeData {
  title?: string;
  url?: string;
  label?: string;
  frameWidth?: number;
  frameHeight?: number;
}

export default function ImageNode(props: NodeProps) {
  const data = props.data as ImageNodeData;

  return (
    <BaseNode
      id={props.id}
      data={props.data}
      selected={props.selected}
      minWidth={200}
      minHeight={150}
    >
      <div className="w-full h-full overflow-hidden">
        {data.url ? (
          <img 
            src={data.url} 
            alt={data.label || "Image"}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">🖼️</div>
              <div>{data.label || "Image"}</div>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
