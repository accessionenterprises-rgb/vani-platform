"""Call state machine model."""
import time
from dataclasses import dataclass, field
from enum import Enum
from typing import Optional


class CallStatus(str, Enum):
    INCOMING       = "incoming"
    ROUTING        = "routing"
    CONNECTING     = "connecting"
    ACTIVE         = "active"
    ENDING         = "ending"
    POST_PROCESSING = "post_processing"
    COMPLETED      = "completed"
    FAILED         = "failed"


# Valid transitions — enforced by update_status()
TRANSITIONS: dict[CallStatus, list[CallStatus]] = {
    CallStatus.INCOMING:        [CallStatus.ROUTING,   CallStatus.FAILED],
    CallStatus.ROUTING:         [CallStatus.CONNECTING, CallStatus.FAILED],
    CallStatus.CONNECTING:      [CallStatus.ACTIVE,    CallStatus.FAILED],
    CallStatus.ACTIVE:          [CallStatus.ENDING,    CallStatus.FAILED],
    CallStatus.ENDING:          [CallStatus.POST_PROCESSING, CallStatus.COMPLETED, CallStatus.FAILED],
    CallStatus.POST_PROCESSING: [CallStatus.COMPLETED, CallStatus.FAILED],
    CallStatus.COMPLETED:       [],
    CallStatus.FAILED:          [],
}


@dataclass
class CallState:
    call_id:         str
    tenant_id:       str
    agent_id:        str
    phone:           str
    status:          CallStatus
    engine:          str = "livekit"  # "livekit" | "agora"
    livekit_room:    Optional[str] = None
    agora_channel:   Optional[str] = None
    agora_agent_id:  Optional[str] = None
    twilio_call_sid: Optional[str] = None
    worker_id:       Optional[int] = None
    error:           Optional[str] = None
    created_at:      float = field(default_factory=time.time)
    updated_at:      float = field(default_factory=time.time)

    def update_status(self, new_status: CallStatus, error: str | None = None) -> None:
        allowed = TRANSITIONS.get(self.status, [])
        if new_status not in allowed:
            raise ValueError(f"Invalid transition: {self.status} → {new_status}")
        self.status = new_status
        self.updated_at = time.time()
        if error:
            self.error = error

    def to_dict(self) -> dict:
        return {
            "call_id":         self.call_id,
            "tenant_id":       self.tenant_id,
            "agent_id":        self.agent_id,
            "phone":           self.phone,
            "status":          self.status.value,
            "engine":          self.engine,
            "livekit_room":    self.livekit_room,
            "agora_channel":   self.agora_channel,
            "agora_agent_id":  self.agora_agent_id,
            "twilio_call_sid": self.twilio_call_sid,
            "worker_id":       self.worker_id,
            "error":           self.error,
            "created_at":      self.created_at,
            "updated_at":      self.updated_at,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "CallState":
        return cls(
            call_id         = d["call_id"],
            tenant_id       = d["tenant_id"],
            agent_id        = d["agent_id"],
            phone           = d["phone"],
            status          = CallStatus(d["status"]),
            engine          = d.get("engine", "livekit"),
            livekit_room    = d.get("livekit_room"),
            agora_channel   = d.get("agora_channel"),
            agora_agent_id  = d.get("agora_agent_id"),
            twilio_call_sid = d.get("twilio_call_sid"),
            worker_id       = d.get("worker_id"),
            error           = d.get("error"),
            created_at      = d.get("created_at", time.time()),
            updated_at      = d.get("updated_at", time.time()),
        )
