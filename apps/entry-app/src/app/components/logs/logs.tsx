import { IDiaryLog } from '../../domains/log.domain';

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
            <li id={log.id}>
              {log.message}, {log.basket_name}
            </li>
          ))}
      </ul>
    </>
  );
};
