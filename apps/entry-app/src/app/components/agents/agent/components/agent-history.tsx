import React, { useEffect, useState } from 'react';
import {
  Box,
  Input,
  Modal,
  ModalDialog,
  Typography,
  List,
  ListItem,
  ListItemContent,
  CircularProgress,
  useTheme,
} from '@mui/joy';
import { IAgentHistoryItem, IAgentHistoryResponse } from '../../../../domains/agent.domain';
import { getAgentHistory } from '../../../../api/agents/agents.api';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';

interface IAgentHistoryModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
}

export const AgentHistoryModal: React.FC<IAgentHistoryModalProps> = ({ open, onClose, agentId }) => {
  // const [history, setHistory] = useState<IAgentHistoryItem[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<IAgentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const theme = useTheme();
  const fetchHistory = async (): Promise<IAgentHistoryResponse | undefined> => {
    setLoading(true);
    try {
      return await getAgentHistory(agentId);
    } catch (error) {
      console.error('Failed to fetch agent history:', error);
    } finally {
      setLoading(false);
    }
  };
  const query = useQuery({
    queryKey: ['agents-history', agentId],
    queryFn: fetchHistory,
    enabled: open,
    select: (data) => data?.history,
  });

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, agentId]);

  useEffect(() => {
    const filtered = query.data?.filter(
      (item) =>
        item.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.response.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredHistory(filtered ?? []);
  }, [query.data, searchTerm]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          [theme.breakpoints.down('sm')]: {
            padding: '5px', // Reduced padding for mobile
          },
          width: {
            xs: '90%',
            sm: '80%',
            md: '70%',
            lg: '60%',
            xl: '50%',
          },
          maxWidth: 1200,
          height: '85vh',
          overflowY: 'auto',
        }}
      >
        {' '}
        <Typography level="h4">Agent History</Typography>
        <Input
          type="text"
          placeholder="Search history..."
          value={searchTerm}
          onChange={handleSearchChange}
          sx={{ mb: 2, width: '100%', position: 'sticky', top: 0, zIndex: 1 }}
        />
        {loading ? (
          <CircularProgress />
        ) : (
          <List>
            {filteredHistory.map((item, index) => (
              <ListItem
                key={index}
                sx={{
                  [theme.breakpoints.down('sm')]: {
                    padding: '0',
                  },
                }}
              >
                <ListItemContent>
                  <Box
                    sx={{
                      border: '1px solid',
                      borderColor: 'divider',
                      borderRadius: 'sm',
                      p: 2,
                      mb: 2,
                      [theme.breakpoints.down('sm')]: {
                        padding: '5px',
                      },
                    }}
                  >
                    <Typography>
                      <Typography level="title-md" color={'neutral'}>
                        Instructions:
                      </Typography>{' '}
                      {item.prefix}
                    </Typography>
                    <Typography>
                      <Typography level="title-md" color={'primary'}>
                        Message:
                      </Typography>{' '}
                      {item.message}
                    </Typography>
                    <Typography>
                      <Typography level="title-md" color="success">
                        Response:
                      </Typography>
                      <ReactMarkdown>{item.response}</ReactMarkdown>
                    </Typography>
                  </Box>{' '}
                </ListItemContent>
              </ListItem>
            ))}
          </List>
        )}
      </ModalDialog>
    </Modal>
  );
};
