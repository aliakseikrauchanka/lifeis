import { EditableInput } from '@lifeis/common-ui';
import { IconButton } from '@mui/joy';
import { Archive, ContentCopy, Dashboard, Delete, PushPin, PushPinOutlined, Unarchive } from '@mui/icons-material';
import { MouseEvent } from 'react';
import css from './agent-header.module.scss';

interface IAgentHeaderProps {
  id: string;
  name: string;
  type: 'agent' | 'template';
  userId: string;
  loggedInUserId: string;
  isArchived?: boolean;
  isPinned: boolean;
  onPin: () => void;
  onUnpin: () => void;
  onNameChange: (newName: string) => void;
  onArchiveToggle: () => void;
  onMakeTemplate: (e: MouseEvent<HTMLButtonElement>) => void;
  onCloneTemplate: (e: MouseEvent<HTMLButtonElement>) => void;
  onRemove: (e: MouseEvent<HTMLButtonElement>) => void;
}

export const AgentHeader = ({
  name,
  type,
  userId,
  loggedInUserId,
  isArchived,
  isPinned,
  onPin,
  onUnpin,
  onNameChange,
  onArchiveToggle,
  onMakeTemplate,
  onCloneTemplate,
  onRemove,
}: IAgentHeaderProps) => {
  return (
    <header className={css.header}>
      <IconButton size="sm" color="primary">
        {isPinned ? <PushPin onClick={onUnpin} /> : <PushPinOutlined onClick={onPin} />}
      </IconButton>
      <h3 className={css.headerName} title={name}>
        <EditableInput initialValue={name} onValueChange={onNameChange} />
      </h3>
      <div className={css.deleteBtnContainer}>
        {type === 'agent' && (
          <IconButton aria-label="Archive/Unarchive" size="sm" color="primary" onClick={onArchiveToggle}>
            {isArchived ? <Unarchive /> : <Archive />}
          </IconButton>
        )}
        <IconButton
          aria-label="Clone"
          size="sm"
          color="warning"
          onClick={type === 'agent' ? onMakeTemplate : onCloneTemplate}
        >
          {type === 'agent' ? <Dashboard /> : <ContentCopy />}
        </IconButton>
        {userId === loggedInUserId && (
          <IconButton aria-label="Delete" size="sm" color="danger" onClick={onRemove}>
            <Delete />
          </IconButton>
        )}
      </div>
    </header>
  );
};
