import React from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useSensor,
  useSensors,
  MouseSensor,
  useDraggable,
  useDroppable,
} from '@dnd-kit/core';

const DraggableItem: React.FC<{ id: string }> = ({ id }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id,
  });

  const style = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  React.useEffect(() => {
    console.log('🔧 DraggableItem:', id, {
      hasListeners: !!listeners,
      hasAttributes: !!attributes,
      hasRef: !!setNodeRef,
      transform,
      isDragging
    });
  }, [id, listeners, attributes, setNodeRef, transform, isDragging]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className="w-20 h-20 bg-red-500 cursor-move m-2 flex items-center justify-center text-white font-bold"
      onPointerDown={() => console.log('🔧 Pointer down on:', id)}
    >
      {id}
    </div>
  );
};

const DropZone: React.FC = () => {
  const { setNodeRef, isOver } = useDroppable({
    id: 'dropzone',
  });

  return (
    <div
      ref={setNodeRef}
      className={`w-40 h-40 border-2 border-dashed ${isOver ? 'border-green-500 bg-green-100' : 'border-gray-400'} m-4 flex items-center justify-center`}
    >
      Drop Zone
    </div>
  );
};

export const DragTest: React.FC = () => {
  const [activeId, setActiveId] = React.useState<string | null>(null);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    console.log('🎯 TEST: Drag started!', event.active.id);
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    console.log('🎯 TEST: Drag ended!', event.active.id, event.over?.id);
    setActiveId(null);
  };

  return (
    <div className="p-8 bg-gray-100 min-h-screen">
      <h2 className="text-2xl font-bold mb-4 text-black">Drag Test</h2>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex items-start">
          <div>
            <h3 className="text-lg font-semibold mb-2 text-black">Draggable Items:</h3>
            <DraggableItem id="item-1" />
            <DraggableItem id="item-2" />
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-2 text-black">Drop Zone:</h3>
            <DropZone />
          </div>
        </div>

        <DragOverlay>
          {activeId ? (
            <div className="w-20 h-20 bg-blue-500 cursor-move flex items-center justify-center text-white font-bold opacity-75">
              {activeId}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
};