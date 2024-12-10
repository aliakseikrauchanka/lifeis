import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
} from '@mui/joy';
import { IAgentHistoryItem, IAgentHistoryResponse } from '../../../../domains/agent.domain';
import { getAgentHistory } from '../../../../api/agents/agents.api';
import ReactMarkdown from 'react-markdown';
import { useQuery } from '@tanstack/react-query';
import { Clear } from '@mui/icons-material';

interface IAgentHistoryModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
}

const highlightText = (text: string, searchTerm: string): string => {
  if (!searchTerm) return text;

  const regex = new RegExp(`(${searchTerm})`, 'gi');
  return text.replace(regex, '<mark style="background-color: yellow">$1</mark>');
};

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
        item.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
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
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2, position: 'relative' }}>
          <Input
            type="text"
            placeholder="Search history..."
            value={searchTerm}
            onChange={handleSearchChange}
            sx={{ mb: 2, width: '100%', position: 'sticky', top: 0, zIndex: 1 }}
          />
          <IconButton
            onClick={() => setSearchTerm('')}
            sx={{
              position: 'absolute',
              top: 0,
              right: 0,
              zIndex: 1,
              backgroundColor: 'transparent',
              color: 'text.primary',
              '&:hover': {
                backgroundColor: 'transparent',
              },
            }}
          >
            <Clear />
          </IconButton>
        </Box>
        {loading ? (
          <CircularProgress />
        ) : (
          <List>
            {filteredHistory.map((item, index) => (
              <ListItem
                key={item._id}
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
                    <Accordion>
                      <AccordionSummary sx={{ marginRight: '28px', backgroundColor: '#f5f5f5', height: '60px' }}>
                        <Typography level="title-md" color={'neutral'}>
                          Instructions:
                        </Typography>{' '}
                      </AccordionSummary>
                      <AccordionDetails>{item.prefix}</AccordionDetails>
                    </Accordion>
                    {/* <EditableInput></EditableInput> */}
                    <Typography>
                      <Typography level="title-md" color={'primary'}>
                        Message:
                      </Typography>{' '}
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {searchTerm.length >= 2 ? highlightText(item.message ?? '', searchTerm) : item.message}
                      </ReactMarkdown>
                    </Typography>
                    <Typography>
                      <Typography level="title-md" color="success">
                        Response:
                      </Typography>
                      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                        {searchTerm.length >= 2 ? highlightText(item.response, searchTerm) : item.response}
                      </ReactMarkdown>
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
