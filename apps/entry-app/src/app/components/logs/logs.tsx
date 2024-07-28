import { IDiaryLog } from '../../domains/log.domain';

interface ILogsProps {
  logs: IDiaryLog[] | undefined;
}

export const Logs = ({ logs }: ILogsProps) => {
  return (
    <ul>
      {!!logs?.length &&
        logs.map((log) => (
          <li>
            {log.message}, {log.basket_name}
          </li>
        ))}
    </ul>
  );
};
