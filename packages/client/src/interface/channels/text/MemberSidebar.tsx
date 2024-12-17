import { For, Match, Show, Switch, createMemo, onMount } from "solid-js";

import { VirtualContainer } from "@minht11/solid-virtual-container";
import { Channel, ServerMember, User } from "@upryzing/upryzing.js";
import { styled } from "styled-system/jsx";

import { floatingUserMenus } from "@revolt/app/menus/UserContextMenu";
import { useClient } from "@revolt/client";
import { useTranslation } from "@revolt/i18n";
import { TextWithEmoji } from "@revolt/markdown";
import { userInformation } from "@revolt/markdown/users";
import {
  Avatar,
  Deferred,
  MenuButton,
  OverflowingText,
  Row,
  Tooltip,
  Typography,
  UserStatus,
  UserStatusGraphic,
  Username,
  styled as styledLegacy,
} from "@revolt/ui";

interface Props {
  /**
   * Channel
   */
  channel: Channel;
}

/**
 * Member Sidebar
 */
export function MemberSidebar(props: Props) {
  return (
    <Switch>
      <Match when={props.channel.type === "Group"}>
        <GroupMemberSidebar channel={props.channel} />
      </Match>
      <Match when={props.channel.type === "TextChannel"}>
        <ServerMemberSidebar channel={props.channel} />
      </Match>
    </Switch>
  );
}

/**
 * Servers to not fetch all members for
 */
const IGNORE_ALL = ["01F7ZSBSFHQ8TA81725KQCSDDP", "01F80118K1F2EYD9XAMCPQ0BCT"];

/**
 * Server Member Sidebar
 */
export function ServerMemberSidebar(props: Props) {
  const client = useClient();
  let scrollTargetElement!: HTMLDivElement;

  onMount(() =>
    props.channel.server?.syncMembers(
      IGNORE_ALL.includes(props.channel.serverId) ? true : false
    )
  );

  // Stage 1: Find roles and members
  const stage1 = createMemo(() => {
    const hoistedRoles = props.channel.server!.orderedRoles.filter(
      (role) => role.hoist
    );

    const members = client().serverMembers.filter(
      (member) => member.id.server === props.channel.serverId
    );

    return [members, hoistedRoles] as const;
  });

  // Stage 2: Filter members by permissions (if necessary)
  const stage2 = createMemo(() => {
    const [members] = stage1();
    if (props.channel.potentiallyRestrictedChannel) {
      return members.filter((member) =>
        member.hasPermission(props.channel, "ViewChannel")
      );
    } else {
      return members;
    }
  });

  // Stage 3: Categorise each member entry into role lists
  const stage3 = createMemo(() => {
    const [, hoistedRoles] = stage1();
    const members = stage2();

    const byRole: Record<string, ServerMember[]> = { default: [], offline: [] };
    hoistedRoles.forEach((role) => (byRole[role.id] = []));

    for (const member of members) {
      if (!member.user?.online) {
        byRole["offline"].push(member);
        continue;
      }

      if (member.roles.length) {
        let assigned;
        for (const hoistedRole of hoistedRoles) {
          if (member.roles.includes(hoistedRole.id)) {
            byRole[hoistedRole.id].push(member);
            assigned = true;
            break;
          }
        }

        if (assigned) continue;
      }

      byRole["default"].push(member);
    }

    return [
      ...hoistedRoles.map((role) => ({
        role,
        members: byRole[role.id],
      })),
      {
        role: {
          id: "default",
          name: "Online",
        },
        members: byRole["default"],
      },
      {
        role: {
          id: "offline",
          name: "Offline",
        },
        members: byRole["offline"],
      },
    ].filter((entry) => entry.members.length);
  });

  // Stage 4: Perform sorting on role lists
  const roles = createMemo(() => {
    const roles = stage3();

    return roles.map((entry) => ({
      ...entry,
      members: [...entry.members].sort(
        (a, b) =>
          (a.nickname ?? a.user?.displayName)?.localeCompare(
            b.nickname ?? b.user?.displayName ?? ""
          ) || 0
      ),
    }));
  });

  // Stage 5: Flatten into a single list with caching
  const objectCache = new Map();

  const elements = createMemo(() => {
    const elements: (
      | { t: 0; name: string; count: number }
      | { t: 1; member: ServerMember }
    )[] = [];

    // Create elements
    for (const role of roles()) {
      const roleElement = objectCache.get(role.role.name + role.members.length);
      if (roleElement) {
        elements.push(roleElement);
      } else {
        elements.push({
          t: 0,
          name: role.role.name,
          count: role.members.length,
        });
      }

      for (const member of role.members) {
        const memberElement = objectCache.get(member.id);
        if (memberElement) {
          elements.push(memberElement);
        } else {
          elements.push({
            t: 1,
            member,
          });
        }
      }
    }

    // Flush cache
    objectCache.clear();

    // Populate cache
    for (const element of elements) {
      if (element.t === 0) {
        objectCache.set(element.name + element.count, element);
      } else {
        objectCache.set(element.member.id, element);
      }
    }

    return elements;
  });

  return (
    <Base
      ref={scrollTargetElement}
      use:scrollable={{
        direction: "y",
        showOnHover: true,
      }}
    >
      <Container>
        <MemberTitle bottomMargin="yes">
          <Typography variant="category">
            <Row align>
              <UserStatus size="0.7em" status="Online" />
              {
                client().serverMembers.filter(
                  (member) =>
                    (member.id.server === props.channel.serverId &&
                      member.user?.online) ||
                    false
                ).length
              }{" "}
              members online
            </Row>
          </Typography>
        </MemberTitle>

        <Deferred>
          <VirtualContainer
            items={elements()}
            scrollTarget={scrollTargetElement}
            itemSize={{ height: 42 }}
          >
            {(item) => (
              <div
                style={{
                  ...item.style,
                  width: "100%",
                }}
              >
                <Switch
                  fallback={
                    <CategoryTitle>
                      <Typography variant="category">
                        {(item.item as { name: string }).name} {"–"}{" "}
                        {(item.item as { count: number }).count}
                      </Typography>
                    </CategoryTitle>
                  }
                >
                  <Match when={item.item.t === 1}>
                    <Member
                      member={(item.item as { member: ServerMember }).member}
                    />
                  </Match>
                </Switch>
              </div>
            )}
          </VirtualContainer>
        </Deferred>
      </Container>
    </Base>
  );
}

/**
 * Group Member Sidebar
 */
export function GroupMemberSidebar(props: Props) {
  let scrollTargetElement!: HTMLDivElement;

  return (
    <Base
      ref={scrollTargetElement}
      use:scrollable={{
        direction: "y",
        showOnHover: true,
      }}
    >
      <Container>
        <MemberTitle>
          <Typography variant="category">
            <Row align>{props.channel.recipientIds.size} members</Row>
          </Typography>
        </MemberTitle>

        <Deferred>
          <VirtualContainer
            items={props.channel.recipients.toSorted((a, b) =>
              a.displayName.localeCompare(b.displayName)
            )}
            scrollTarget={scrollTargetElement}
            itemSize={{ height: 42 }}
          >
            {(item) => (
              <div
                style={{
                  ...item.style,
                  width: "100%",
                }}
              >
                <Member user={item.item} />
              </div>
            )}
          </VirtualContainer>
        </Deferred>
      </Container>
    </Base>
  );
}

/**
 * Base styles
 */
const Base = styledLegacy.div`
  flex-shrink: 0;

  width: ${(props) => props.theme!.layout.width["channel-sidebar"]};
  margin: ${(props) => (props.theme!.gap.md + " ").repeat(3)}0;
  margin-top: calc(48px + 2 * ${(props) => props.theme!.gap.md});
  border-radius: ${(props) => props.theme!.borderRadius.lg};

  color: ${({ theme }) => theme!.colours["sidebar-channels-foreground"]};
  background: ${({ theme }) => theme!.colours["sidebar-channels-background"]};
`;

/**
 * Container styles
 */
const Container = styledLegacy.div`
  width: ${(props) => props.theme!.layout.width["channel-sidebar"]};
`;

/**
 * Category Title
 */
const CategoryTitle = styledLegacy.div`
  padding: 16px 14px 0;
`;

/**
 * Member title
 */
const MemberTitle = styled("div", {
  base: {
    marginTop: "12px",
    marginLeft: "14px",
  },
  variants: {
    bottomMargin: {
      no: {},
      yes: {
        marginBottom: "-12px",
      },
    },
  },
});

/**
 * Styles required to correctly display name and status
 */
const NameStatusStack = styled("div", {
  base: {
    height: "100%",

    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
  },
});

/**
 * Member
 */
function Member(props: { user?: User; member?: ServerMember }) {
  const t = useTranslation();

  /**
   * Create user information
   */
  const user = () =>
    userInformation(props.user ?? props.member?.user!, props.member);

  /**
   * Get user status
   */
  const status = () =>
    (props.user ?? props.member?.user)?.statusMessage((presence) =>
      t(`app.status.${presence.toLowerCase()}`)
    );

  return (
    <div
      use:floating={floatingUserMenus(
        props.user ?? props.member?.user!,
        props.member
      )}
    >
      <MenuButton
        size="normal"
        attention={
          (props.user ?? props.member?.user)?.online ? "active" : "muted"
        }
        icon={
          <Avatar
            src={user().avatar}
            size={32}
            holepunch="bottom-right"
            overlay={
              <UserStatusGraphic
                status={(props.user ?? props.member?.user)?.presence}
              />
            }
          />
        }
      >
        <NameStatusStack>
          <OverflowingText>
            <Username username={user().username} colour={user().colour!} />
          </OverflowingText>
          <Show when={status()}>
            <Tooltip
              content={() => <TextWithEmoji content={status()!} />}
              placement="top-start"
              aria={status()!}
            >
              <OverflowingText>
                <Typography variant="status">
                  <TextWithEmoji content={status()!} />
                </Typography>
              </OverflowingText>
            </Tooltip>
          </Show>
        </NameStatusStack>
      </MenuButton>
    </div>
  );
}
