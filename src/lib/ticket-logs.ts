/** Default status-change log message templates for ticket Logs */

export function defaultStatusLogMessage(params: {
  status: string;
  creatorName: string;
  actorName: string;
  ticketNumber?: string;
}): string {
  const creator = params.creatorName || "Requester";
  const tech = params.actorName || "Technician";
  const status = params.status;

  if (status === "On Hold") {
    return [
      `Dear, ${creator} Your Ticket on Hold by ${tech}`,
      "With reasons:",
      "",
      "",
      "Thank You.",
      "Best Regards,",
      tech,
    ].join("\n");
  }

  if (status === "Reject") {
    return [
      `Dear, ${creator} Your Ticket Rejected by ${tech}`,
      "With reasons:",
      "",
      "",
      "Thank You.",
      "Best Regards,",
      tech,
    ].join("\n");
  }

  if (status === "In Progress") {
    return [
      `Dear, ${creator}`,
      `Your Ticket is now In Progress by ${tech}.`,
      "",
      "Thank You.",
      "Best Regards,",
      tech,
    ].join("\n");
  }

  if (status === "Closed") {
    return [
      `Dear, ${creator}`,
      `Your Ticket has been Closed by ${tech}.`,
      "With notes:",
      "",
      "",
      "Thank You.",
      "Best Regards,",
      tech,
    ].join("\n");
  }

  if (status === "Open") {
    return [
      `Dear, ${creator}`,
      `Your Ticket status is Open (updated by ${tech}).`,
      "",
      "Thank You.",
      "Best Regards,",
      tech,
    ].join("\n");
  }

  return [
    `Dear, ${creator}`,
    `Your Ticket status changed to ${status} by ${tech}.`,
    "",
    "Thank You.",
    "Best Regards,",
    tech,
  ].join("\n");
}

export function ticketCreatedLogMessage(params: {
  ticketNumber: string;
  displayName: string;
  email: string;
}): string {
  return `This Ticket ${params.ticketNumber} Was Created by ${params.displayName} ${params.email}`;
}
