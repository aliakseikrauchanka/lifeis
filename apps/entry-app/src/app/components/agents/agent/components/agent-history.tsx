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
} from '@mui/joy';
import { IAgentHistory } from '../../../../domains/agent.domain';
import { getAgentHistory } from '../../../../api/agents/agents.api';
import ReactMarkdown from 'react-markdown';

interface HistoryModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
}

export const HistoryModal: React.FC<HistoryModalProps> = ({ open, onClose, agentId }) => {
  const [history, setHistory] = useState<IAgentHistory[]>([]);
  const [filteredHistory, setFilteredHistory] = useState<IAgentHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, agentId]);

  useEffect(() => {
    const filtered = history.filter(
      (item) =>
        item.prompt.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.response.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredHistory(filtered);
  }, [searchTerm, history]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const response = await getAgentHistory(agentId);
      setHistory(response.history);
      setFilteredHistory(response.history);
    } catch (error) {
      console.error('Failed to fetch agent history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  return (
    <Modal open={open} onClose={onClose}>
      <ModalDialog
        sx={{
          width: {
            xs: '90%',
            sm: '80%',
            md: '70%',
            lg: '60%',
            xl: '50%',
          },
          maxWidth: 1200,
          maxHeight: '90vh',
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
          sx={{ mb: 2, width: '100%' }}
        />
        {loading ? (
          <CircularProgress />
        ) : (
          <List>
            {filteredHistory.map((item, index) => (
              <ListItem key={index}>
                <ListItemContent>
                  <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 'sm', p: 2, mb: 2 }}>
                    <Typography>
                      <Typography level="title-md" color={'primary'}>
                        Prompt:
                      </Typography>{' '}
                      {item.prompt}
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
