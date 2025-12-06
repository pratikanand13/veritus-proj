import * as d3 from 'd3'
import { Selection } from 'd3-selection'

export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

const easingMap: Record<EasingType, (t: number) => number> = {
  linear: d3.easeLinear,
  easeIn: d3.easeQuadIn,
  easeOut: d3.easeQuadOut,
  easeInOut: d3.easeQuadInOut
}

/**
 * Animate node/edge fade in
 */
export function fadeIn<T extends d3.BaseType>(
  selection: Selection<T, unknown, null, undefined>,
  duration: number = 500,
  easing: EasingType = 'easeOut'
) {
  selection
    .style('opacity', 0)
    .transition()
    .duration(duration)
    .ease(easingMap[easing])
    .style('opacity', 1)
}

/**
 * Animate node/edge fade out
 */
export function fadeOut<T extends d3.BaseType>(
  selection: Selection<T, unknown, null, undefined>,
  duration: number = 300,
  easing: EasingType = 'easeIn',
  onComplete?: () => void
) {
  const transition = selection
    .transition()
    .duration(duration)
    .ease(easingMap[easing])
    .style('opacity', 0)
  
  if (onComplete) {
    transition.on('end', onComplete)
  }
  
  return transition
}

/**
 * Animate node position change
 */
export function animatePosition<T extends d3.BaseType>(
  selection: Selection<T, unknown, null, undefined>,
  duration: number = 500,
  easing: EasingType = 'easeInOut'
) {
  return selection
    .transition()
    .duration(duration)
    .ease(easingMap[easing])
}

/**
 * Animate node size change
 */
export function animateSize<T extends d3.BaseType>(
  selection: Selection<T, unknown, null, undefined>,
  duration: number = 400,
  easing: EasingType = 'easeOut'
) {
  return selection
    .transition()
    .duration(duration)
    .ease(easingMap[easing])
}

/**
 * Animate path highlighting
 */
export function highlightPath<T extends d3.BaseType>(
  selection: Selection<T, unknown, null, undefined>,
  duration: number = 300
) {
  return selection
    .transition()
    .duration(duration)
    .attr('stroke-width', (d: any) => (d.strokeWidth || 2) * 2)
    .attr('stroke-opacity', 1)
    .transition()
    .duration(duration)
    .attr('stroke-width', (d: any) => d.strokeWidth || 2)
    .attr('stroke-opacity', 0.6)
}

/**
 * Pulse animation for selected nodes
 */
export function pulse<T extends d3.BaseType>(
  selection: Selection<T, unknown, null, undefined>,
  duration: number = 1000
) {
  const pulse = () => {
    selection
      .transition()
      .duration(duration / 2)
      .attr('r', (d: any) => (d.r || 10) * 1.2)
      .transition()
      .duration(duration / 2)
      .attr('r', (d: any) => d.r || 10)
      .on('end', pulse)
  }
  
  pulse()
}

/**
 * Stop pulse animation
 */
export function stopPulse<T extends d3.BaseType>(
  selection: Selection<T, unknown, null, undefined>
) {
  selection.interrupt()
}

