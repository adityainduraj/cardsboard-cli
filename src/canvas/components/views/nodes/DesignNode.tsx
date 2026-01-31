import { NodeProps } from "@xyflow/react";
import { BaseNode } from "../shared/BaseNode";

export interface DesignNodeData {
  title?: string;
  htmlContent?: string;
  frameWidth?: number;
  frameHeight?: number;
}

export default function DesignNode(props: NodeProps) {
  const data = props.data as DesignNodeData;

  return (
    <BaseNode
      id={props.id}
      data={props.data}
      selected={props.selected}
      minWidth={280}
      minHeight={250}
    >
      <div className="w-full h-full overflow-auto">
        {data.htmlContent ? (
          <div 
            className="w-full h-full"
            dangerouslySetInnerHTML={{ __html: data.htmlContent }} 
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            <div className="text-center">
              <div className="text-4xl mb-2">🎨</div>
              <div>Double click to edit</div>
            </div>
          </div>
        )}
      </div>
    </BaseNode>
  );
}
