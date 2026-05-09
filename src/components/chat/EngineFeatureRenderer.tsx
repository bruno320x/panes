/**
 * EngineFeatureRenderer
 * 
 * A component that conditionally renders children based on engine feature availability.
 * Shows a visual fallback when the feature is not available.
 */

import { type ReactNode, useMemo } from "react";
import { getEngineFeatures, type FeatureKey } from "./engineFeatureFlags";

interface EngineFeatureRendererProps {
  /** The engine ID to check features against */
  engineId: string;
  /** The feature to check availability for */
  feature: FeatureKey;
  /** Children to render if the feature is available */
  children: ReactNode;
  /** Custom fallback message to display when feature is unavailable */
  fallback?: ReactNode;
  /** Optional tooltip text explaining why the feature is unavailable */
  unavailableReason?: string;
  /** Optional class name for the fallback badge */
  fallbackClassName?: string;
  /** Whether to show the fallback badge inline (default: false - renders children only) */
  showFallback?: boolean;
}

const FALLBACK_CLASS_NAME = "engine-feature-fallback";

export function EngineFeatureRenderer({
  engineId,
  feature,
  children,
  fallback = "N/A",
  unavailableReason,
  fallbackClassName = FALLBACK_CLASS_NAME,
  showFallback = false,
}: EngineFeatureRendererProps): ReactNode {
  const features = useMemo(() => getEngineFeatures(engineId), [engineId]);
  const isAvailable = features[feature] as boolean;

  if (isAvailable) {
    return children;
  }

  // When feature is not available and showFallback is true, render both children and fallback
  if (showFallback) {
    return (
      <>
        {children}
        {unavailableReason ? (
          <span
            className={fallbackClassName}
            title={unavailableReason}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 6px",
              fontSize: "10px",
              backgroundColor: "var(--text-4)",
              color: "var(--text-1)",
              borderRadius: "4px",
              marginLeft: "6px",
              opacity: 0.7,
            }}
          >
            {fallback}
          </span>
        ) : (
          <span
            className={fallbackClassName}
            style={{
              display: "inline-flex",
              alignItems: "center",
              padding: "2px 6px",
              fontSize: "10px",
              backgroundColor: "var(--text-4)",
              color: "var(--text-1)",
              borderRadius: "4px",
              marginLeft: "6px",
              opacity: 0.7,
            }}
          >
            {fallback}
          </span>
        )}
      </>
    );
  }

  return null;
}

/**
 * A version of EngineFeatureRenderer that always shows the fallback badge
 * when the feature is unavailable (without hiding children)
 */
export function EngineFeatureBadge({
  engineId,
  feature,
  label = "N/A",
  reason,
}: {
  engineId: string;
  feature: FeatureKey;
  label?: string;
  reason?: string;
}): ReactNode {
  const features = useMemo(() => getEngineFeatures(engineId), [engineId]);
  const isAvailable = features[feature] as boolean;

  if (isAvailable) {
    return null;
  }

  return (
    <span
      title={reason}
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "2px 6px",
        fontSize: "10px",
        backgroundColor: "var(--text-4)",
        color: "var(--text-1)",
        borderRadius: "4px",
        marginLeft: "6px",
        opacity: 0.7,
        cursor: "help",
      }}
    >
      {label}
    </span>
  );
}

/**
 * Hook to check if a feature is available for a given engine
 */
export function useEngineFeature(
  engineId: string,
  feature: FeatureKey
): boolean {
  return useMemo(() => {
    const features = getEngineFeatures(engineId);
    return features[feature] as boolean;
  }, [engineId, feature]);
}