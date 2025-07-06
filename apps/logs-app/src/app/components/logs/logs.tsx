import { IDiaryLog } from '../../../../../logs-app/src/app/domains/log.domain';
import { Chip } from '@mui/material';

interface ILogsProps {
  logs: IDiaryLog[] | undefined;
}

export const Logs = ({ logs }: ILogsProps) => {
  return (
    <>
      <h2>Logs</h2>
      <ul>
        {!!logs?.length &&
          logs.map((log) => (
            <li key={log.id} id={log.id}>
              {log.message} <Chip label={log.basket_name} />
            </li>
          ))}
      </ul>
    </>
  );
};
