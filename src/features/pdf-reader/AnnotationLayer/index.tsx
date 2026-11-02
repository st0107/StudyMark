import type { Annotation } from '../../../shared/types';

export function AnnotationLayer({ annotations, activeId }: { annotations: Annotation[]; activeId?: string }) {
  return <div className="pdf-annotation-layer" aria-hidden="true">
    {annotations.filter((annotation) => annotation.type === 'HIGHLIGHT').flatMap((annotation) =>
      annotation.anchor?.rects.map((rect, index) => <span key={`${annotation.id}-${index}`}
        data-annotation-id={annotation.id} className={`pdf-highlight ${activeId === annotation.id ? 'is-active' : ''}`}
        style={{ left: `${rect.x * 100}%`, top: `${rect.y * 100}%`, width: `${rect.width * 100}%`,
          height: `${rect.height * 100}%`, backgroundColor: annotation.color ?? '#FFE066' }} />) ?? [])}
  </div>;
}
