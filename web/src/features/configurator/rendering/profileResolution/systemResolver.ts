import type {
  ResolvedSystemConnection,
  ResolvedSystemConnectionMetadata,
  SystemConnectionInput,
} from "./profileTypes";
import { lookupSystemProfile, type SystemLookupRole } from "./profileLookupTable";

function baseMetadata(input: SystemConnectionInput): ResolvedSystemConnectionMetadata {
  return {
    ...(typeof input.metadata?.angle === "number" ? { angle: input.metadata.angle } : {}),
    ...(input.metadata?.involvedFieldIds ? { involvedFieldIds: input.metadata.involvedFieldIds } : {}),
    ...(typeof input.metadata?.hasTiltTurn === "boolean" ? { hasTiltTurn: input.metadata.hasTiltTurn } : {}),
  };
}

function unresolved(input: {
  connection: SystemConnectionInput;
  metadata?: ResolvedSystemConnectionMetadata;
  note: string;
}): ResolvedSystemConnection {
  return {
    key: input.connection.key,
    domain: input.connection.kind,
    profileRef: "REQUIRES_CONFIRMATION",
    metadata: {
      ...baseMetadata(input.connection),
      ...input.metadata,
    },
    note: input.note,
  };
}

function resolveLookup(input: {
  connection: SystemConnectionInput;
  systemFamily?: string;
  role: SystemLookupRole;
  metadata?: ResolvedSystemConnectionMetadata;
}): ResolvedSystemConnection {
  const lookup = lookupSystemProfile({
    systemFamily: input.systemFamily,
    role: input.role,
  });
  if (!lookup) {
    return unresolved({
      connection: input.connection,
      metadata: input.metadata,
      note: `No system lookup row for ${input.role}.`,
    });
  }
  return {
    key: input.connection.key,
    domain: input.connection.kind,
    profileRef: lookup.profileRef,
    metadata: {
      ...baseMetadata(input.connection),
      ...(lookup.profileRef === "REQUIRES_CONFIRMATION" && lookup.profileOptions
        ? { unresolvedOptions: lookup.profileOptions }
        : {}),
      ...input.metadata,
    },
    note: lookup.notes,
  };
}

function resolveStraightCoupler(input: {
  connection: SystemConnectionInput;
  systemFamily?: string;
}): ResolvedSystemConnection {
  return resolveLookup({
    connection: input.connection,
    systemFamily: input.systemFamily,
    role: "straightCoupler",
    metadata: {
      warning: "Straight coupler option must be selected",
    },
  });
}

function resolveCorner90(input: {
  connection: SystemConnectionInput;
  systemFamily?: string;
}): ResolvedSystemConnection {
  return resolveLookup({
    connection: input.connection,
    systemFamily: input.systemFamily,
    role: "corner90",
    metadata: {
      factoryFittedPost: true,
      warning: "Corner post option must be selected",
    },
  });
}

function resolveAngledBay(input: {
  connection: SystemConnectionInput;
  systemFamily?: string;
}): ResolvedSystemConnection {
  const angle = input.connection.metadata?.angle;
  if (typeof angle !== "number") {
    return unresolved({
      connection: input.connection,
      metadata: {
        warning: "Angle required for angled bay resolution",
      },
      note: "Angled bay requires an angle before profile lookup can resolve.",
    });
  }
  const hasTiltTurn = !!input.connection.metadata?.hasTiltTurn;
  if (angle >= 91 && angle <= 140) {
    return resolveLookup({
      connection: input.connection,
      systemFamily: input.systemFamily,
      role: hasTiltTurn ? "angledBay_tilt" : "angledBay_fixed",
      metadata: {
        angleRange: "91-140",
        ...(hasTiltTurn
          ? {
              singleTiltOnly: true,
              warning: "Only one tilt function allowed in angled bay configuration",
            }
          : {}),
      },
    });
  }
  if (angle >= 141 && angle <= 179) {
    return resolveLookup({
      connection: input.connection,
      systemFamily: input.systemFamily,
      role: hasTiltTurn ? "angledBay_tilt_wide" : "angledBay_fixed_wide",
      metadata: {
        angleRange: "141-179",
        ...(hasTiltTurn
          ? {
              singleTiltOnly: true,
              warning: "Only one tilt function allowed in angled bay configuration",
            }
          : {}),
      },
    });
  }
  return unresolved({
    connection: input.connection,
    metadata: {
      warning: "Angle required for angled bay resolution",
    },
    note: "Angled bay angle is outside supported B92 lookup ranges 91-140 and 141-179.",
  });
}

function resolveGlassToGlass(input: {
  connection: SystemConnectionInput;
  systemFamily?: string;
}): ResolvedSystemConnection {
  return resolveLookup({
    connection: input.connection,
    systemFamily: input.systemFamily,
    role: "glassToGlass",
    metadata: {
      glassToGlass: true,
      siteGlazed: true,
      noCornerPost: true,
    },
  });
}

export function resolveSystemConnections(
  connections: SystemConnectionInput[] = [],
  options: { systemFamily?: string } = {}
): ResolvedSystemConnection[] {
  return connections.map((connection) => {
    if (connection.kind === "straightCoupler") {
      return resolveStraightCoupler({ connection, systemFamily: options.systemFamily });
    }
    if (connection.kind === "corner90") {
      return resolveCorner90({ connection, systemFamily: options.systemFamily });
    }
    if (connection.kind === "angledBay") {
      return resolveAngledBay({ connection, systemFamily: options.systemFamily });
    }
    return resolveGlassToGlass({ connection, systemFamily: options.systemFamily });
  });
}
