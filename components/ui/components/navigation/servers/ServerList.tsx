import { BiSolidCheckShield } from "solid-icons/bi";
import { Accessor, Component, For, Show } from "solid-js";
import { styled } from "solid-styled-components";

import { Channel, User } from "revolt.js";
import { Server } from "revolt.js/dist/maps/Servers";

import { Link } from "@revolt/routing";

import { Draggable } from "../../common/Draggable";
import { InvisibleScrollContainer } from "../../common/ScrollContainers";
import { Button, Column, Typography } from "../../design";
import { Avatar } from "../../design/atoms/display/Avatar";
import {
  UnreadsGraphic,
  UserStatusGraphic,
} from "../../design/atoms/indicators";
import { Tooltip } from "../../floating";

import { Swoosh } from "./Swoosh";

/**
 * Server list container
 */
const ServerListBase = styled(
  InvisibleScrollContainer as Component,
  "ServerList"
)`
  display: flex;
  flex-direction: column;

  background: ${({ theme }) => theme!.colours["background"]};
`;

/**
 * Server entries
 */
const EntryContainer = styled("div", "Entry")`
  width: 56px;
  height: 56px;
  display: grid;
  flex-shrink: 0;
  place-items: center;

  a {
    z-index: 1;
  }
`;

/**
 * Divider line between two lists
 */
const LineDivider = styled.div`
  height: 1px;
  flex-shrink: 0;
  margin: 6px auto;
  width: calc(100% - 24px);
  background: ${({ theme }) => theme!.colours["background-300"]};
`;

/**
 * Position the Swoosh correctly
 */
const PositionSwoosh = styled.div`
  user-select: none;
  position: absolute;
  pointer-events: none;
`;

interface Props {
  /**
   * Ordered server list
   */
  orderedServers: Server[];

  /**
   * Set server ordering
   * @param ids List of IDs
   */
  setServerOrder: (ids: string[]) => void;

  /**
   * Unread conversations list
   */
  unreadConversations: Channel[];

  /**
   * Current logged in user
   */
  user: User;

  /**
   * Selected server id
   */
  selectedServer: Accessor<string | undefined>;
}

/**
 * Server list sidebar component
 */
export const ServerList = (props: Props) => {
  return (
    <ServerListBase>
      <Tooltip
        placement="right"
        content={
          <Column gap="none">
            <span>{props.user.username}</span>
            <Typography variant="small">
              {props.user.status?.presence}
            </Typography>
          </Column>
        }
      >
        {(triggerProps) => (
          <EntryContainer {...triggerProps}>
            <Show when={!props.selectedServer()}>
              <PositionSwoosh>
                <Swoosh />
              </PositionSwoosh>
            </Show>
            <Link href="/">
              <Avatar
                size={42}
                src={
                  props.user.generateAvatarURL({ max_side: 256 }) ??
                  props.user.defaultAvatarURL
                }
                holepunch={"bottom-right"}
                overlay={
                  <UserStatusGraphic
                    status={props.user.status?.presence ?? "Invisible"}
                  />
                }
                interactive
              />
            </Link>
          </EntryContainer>
        )}
      </Tooltip>
      <Show when={props.user.privileged}>
        <EntryContainer>
          <Link href="/admin">
            <Button compact="icon">
              <BiSolidCheckShield size={32} />
            </Button>
          </Link>
        </EntryContainer>
      </Show>
      <For each={props.unreadConversations}>
        {(conversation) => (
          // TODO: displayname on channels
          <Tooltip
            placement="right"
            content={conversation.name ?? conversation.recipient?.username}
          >
            {(triggerProps) => (
              <EntryContainer {...triggerProps}>
                <Link href={`/channel/${conversation._id}`}>
                  <Avatar
                    size={42}
                    // TODO: fix this
                    src={conversation.generateIconURL({ max_side: 256 })}
                    holepunch={conversation.unread ? "top-right" : "none"}
                    overlay={
                      <>
                        <Show when={conversation.unread}>
                          <UnreadsGraphic
                            count={
                              conversation.getMentions({
                                isMuted() {
                                  return false;
                                },
                              }).length
                            }
                            unread
                          />
                        </Show>
                      </>
                    }
                    fallback={conversation.name}
                    interactive
                  />
                </Link>
              </EntryContainer>
            )}
          </Tooltip>
        )}
      </For>
      <LineDivider />
      <Draggable items={props.orderedServers} onChange={props.setServerOrder}>
        {(item) => (
          <Tooltip placement="right" content={item.name}>
            {(triggerProps) => (
              <EntryContainer {...triggerProps}>
                <Show when={props.selectedServer() === item._id}>
                  <PositionSwoosh>
                    <Swoosh />
                  </PositionSwoosh>
                </Show>
                <Link href={`/server/${item._id}`}>
                  <Avatar
                    size={42}
                    // TODO: fix this
                    src={item.generateIconURL({ max_side: 256 })}
                    holepunch={item.isUnread() ? "top-right" : "none"}
                    overlay={
                      <>
                        <Show when={item.isUnread()}>
                          <UnreadsGraphic
                            count={item.getMentions().length}
                            unread
                          />
                        </Show>
                      </>
                    }
                    fallback={item.name}
                    interactive
                  />
                </Link>
              </EntryContainer>
            )}
          </Tooltip>
        )}
      </Draggable>
    </ServerListBase>
  );
};
