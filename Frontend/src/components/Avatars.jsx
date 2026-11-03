import { Avatar, Badge, Box } from "@mui/material";
import { colorFor, initials } from "../lib/format";

export function UserAvatar({ user, size = 44, online = false, ring = false, sx, ...rest }) {
  const av = (
    <Avatar
      src={user?.profilePic || undefined}
      alt={user?.name}
      sx={{
        width: size,
        height: size,
        bgcolor: colorFor(user?._id || user?.name || ""),
        fontSize: size * 0.38,
        fontWeight: 700,
        ...(ring ? { boxShadow: (t) => `0 0 0 3px ${t.palette.background.paper}` } : {}),
        ...sx,
      }}
      {...rest}
    >
      {initials(user?.name)}
    </Avatar>
  );
  if (!online) return av;
  const dot = Math.max(10, Math.round(size * 0.26));
  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      badgeContent={
        <Box
          sx={{
            width: dot,
            height: dot,
            borderRadius: "50%",
            bgcolor: "success.main",
            border: (t) => `2px solid ${t.palette.background.paper}`,
          }}
        />
      }
    >
      {av}
    </Badge>
  );
}

export function SpaceAvatar({ space, size = 44, sx }) {
  return (
    <Avatar
      variant="rounded"
      sx={{
        width: size,
        height: size,
        borderRadius: size * 0.3 + "px",
        bgcolor: colorFor(space?.spaceId || space?.name || ""),
        fontSize: size * 0.36,
        fontWeight: 800,
        ...sx,
      }}
    >
      {initials(space?.name)}
    </Avatar>
  );
}
